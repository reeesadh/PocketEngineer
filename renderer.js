class SimpleEmitter {
    constructor() {this.listeners = {};}
    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }
    off(evt, cb) {
        if (!this.listeners[evt]) return;
        this.listeners[evt] = this.listeners[evt].filter(l => l !== cb);
    }
    once(evt, cb) {
        const wrapper = (...args) => { this.off(evt, wrapper); cb(...args); };
        this.on(evt, wrapper);
    }
    emit(evt, ...args) {
        (this.listeners[evt] || []).forEach(cb => cb(...args));
    }
}
const valueEventEmitter = new SimpleEmitter();



let need_username = false;
let need_physics_level = false;
let setup_incomplete = false;
let need_physics_units = false;
const green_main = "#3385c4";
const green_shadow = "#163954";
const red_main = "#a12f2f";
const red_shadow = "#451616";


// start websocket
const ws = new WebSocket("ws://127.0.0.1:18789"); // TODO: replace with where you are running openclaw

let nonce = null;
let connected = false;
let noHTML = false;

// check if websocket started
ws.onopen = async () => {
    console.log("websocket started")

    const user = await window.electronAPI.storeGet('username');
    const pl = await window.electronAPI.storeGet('physics-level');
    const pu = await window.electronAPI.storeGet('physics-units');

    if (!user || !pl || !pu) {
        setup_incomplete = true;
        globalThis.pul = [];
    }

    if (setup_incomplete) {
        need_username = true;
        need_physics_level = true;
        need_physics_units = true;
        // ask for username
        const chat = document.getElementById("chat");
        const row = document.createElement("div");
        row.className = "msg-row assistant";
        row.innerHTML = `<div style="background-color: rgba(78, 26, 26, 0.72); color: white; width: fit-content; padding: 8px; margin 5px 0; border-radius: 4px;>
        <p style="margin: 0;"><b>assistant:</b> ${"Hello! it seems like you're new here. I am your personal physics learning assistant. Lets start with a few questions, what would you like me to call you?"}</p></div>`;
        chat.appendChild(row);
    }


    // generate unit map
    let pul = await window.electronAPI.storeGet('physics-units');

    

    let pup = await window.electronAPI.storeGet('physics-units-progress');
    let mastot = 0;

    const container = document.getElementById('unit-map');
    for (let p = 0; p < pul.length; p++) {
        const unitwrapper = document.createElement('div');
        unitwrapper.className = "unitprog";

        const ni = document.createElement('button');
        ni.textContent = pul[p];

        ni.style.backgroundColor = red_main;
        ni.style.borderColor = red_shadow;

        const desc = document.createElement('span');
        desc.className = "unitprogtext";
        desc.textContent = "in progress";
        
        if (pup[p] == "mastered") {
            ni.style.backgroundColor = green_main;
            ni.style.borderColor = green_shadow;
            desc.textContent = "mastered";
            mastot++;
        }

        ni.style.fontSize = "30px";
        ni.style.borderRadius = "20px";
        ni.style.borderWidth = "10px";
        
        ni.style.padding = "4px 10px";
        ni.style.color = "#000";
        ni.style.cursor = "pointer";
        ni.style.width = "100%";
        ni.style.fontFamily = "JetBrains Mono";
        ni.onclick = functiontbd;



        unitwrapper.appendChild(ni);
        unitwrapper.appendChild(desc);
        container.appendChild(unitwrapper);

    }

    // update progress bar
    const pb = document.getElementById("progress-bar-filled");
    const fill = 400*mastot/pul.length;
    pb.style.width = `${fill}px`;
    pb.style.backgroundColor = green_main;
};

ws.onerror = (err) => {
    console.error("websocket error", err);
};

ws.onclose = (event) => {
    console.log("websocket closed", event.code, event.reason);
};

// if user sends message
ws.onmessage = async (msg) => {
    // user msg data
    const data = JSON.parse(msg.data);
    console.log("user message lore: ", data);

    // user authorization stuff
    if (data.event == "connect.challenge") {
        const recievednonce = data.payload.nonce;
        console.log("nonce: ", recievednonce);

        // send user msg to openclaw running locally
        const payload = {
            type: "req",
            id: String(crypto.randomUUID()),
            method: "connect",
            params: {
        minProtocol: 3,
                maxProtocol: 4,
                role: "operator",
                scopes: ["operator.read", "operator.write"],
                client: {
                    id: "openclaw-control-ui",
                    version: "1.0.0",
                    platform: "desktop",
                    mode: "ui"
                },
                auth: {
                    token: "YOUR-OPENCLAW-GATEWAY-TOKEN".trim() //TODO: replace with your openclaw gateway token
                },
            }
        };

    console.log("sending user msg: ", JSON.stringify(payload, null, 2));
    ws.send(JSON.stringify(payload));

}

    // check if openclaw connected
    if (data.type === "res" && data.ok && data.payload?.type == "hello-ok") {
        connected = true;
        console.log("connected to openclaw!");

        if (!setup_incomplete) {
            const units = await window.electronAPI.storeGet('physics-units');
            promptOpenclaw("You are my physics study assistant who is helping me study these units: " + units + ". Just respond to this with 'Hey there! Whats your plan for today?'");
        }
        
    }

    // error check
    if (data.event && data.event.includes("error")) {
        console.error("gateway error: ", data);
    }

    // openclaw response
    if (data.event === "chat") {
        const chat = document.getElementById("chat");
        const payload = data.payload;

        // update openclaw response in chunks
        if (payload.state === "delta" && payload.deltaText) {
            // check if openclaw response already in progress
            const existing = document.getElementById("assistant-last");
            // if response already exists append
            if (existing) {
                if (!noHTML) {
                    existing.innerHTML = `<div style="background-color: #210909; color: white; width: fit-content; padding: 8px; margin 5px 0; border-radius: 4px;>
        <p style="margin: 0;"><b>assistant:</b> ${existing.dataset.text + payload.deltaText}</p></div>`;
                    noHTML = false;
                }
                
                existing.dataset.text += payload.deltaText;
            } else { // if response doesn't already exist make one
                const p = document.createElement("p");
                p.id = "assistant-last";
                p.dataset.text = payload.deltaText;
                if (!noHTML) {
                    p.innerHTML = `<div style="background-color: #210909; color: white; width: fit-content; padding: 8px; margin 5px 0; border-radius: 4px;>
        <p style="margin: 0;"><b>assistant:</b> ${payload.deltaText}</p></div>`;    
                }
                chat.appendChild(p);
            }
        }
        
        // clear wip response if last chunk of openclaw response is sent
        if (payload.state === "final") {
            noHTML = false;
            const el = document.getElementById("assistant-last");
            console.log(document.getElementById("assistant-last").dataset.text);
            // update for physics units if needed
            if (need_physics_units) {
                const pu = document.getElementById("assistant-last").dataset.text;
                let word = "";
                let prog = [];
                let puln = [];
                for (let i = 0; i < pu.length; i++) {
                    const c = pu.charAt(i);
                    if (c == ",") {
                        puln.push(word);
                        prog.push("new");
                        word = "";
                    } else if (i==pu.length-1) {
                        word += c;
                        puln.push(word);
                        prog.push("new");
                    } else {
                        word += c;
                    }
                }

                await window.electronAPI.storeSet('physics-units', puln);
                await window.electronAPI.storeSet('physics-units-progress', prog);

                console.log(puln);
                console.log(prog);
                need_physics_units = false;
                setup_incomplete = false;

                // generate unit map first time

                let pul = await window.electronAPI.storeGet('physics-units');
                let pup = await window.electronAPI.storeGet('physics-units-progress');

                const container = document.getElementById('unit-map');
                for (let p = 0; p < pul.length; p++) {
                    const unitwrapper = document.createElement('div');
                    unitwrapper.className = "unitprog";

                    const ni = document.createElement('button');
                    ni.textContent = pul[p];
                    ni.style.backgroundColor = red_main;
                    ni.style.fontSize = "30px";
                    ni.style.borderRadius = "20px";
                    ni.style.borderWidth = "10px";
                    ni.style.borderColor = "#3b211d";
                    ni.style.padding = "4px 10px";
                    ni.style.color = "#000";
                    ni.style.cursor = "pointer";
                    ni.style.width = "100%";
                    ni.style.fontFamily = "JetBrains Mono";
                    ni.onclick = functiontbd;

                    const desc = document.createElement('span');
                    desc.className = "unitprogtext";
                    desc.textContent = "in progress";

                    // if mastered
                    if (pup[p] == 1) {
                        ni.style.backgroundColor = green_main;
                        desc.textContent = "mastered";
                    }

                    unitwrapper.appendChild(ni);
                    unitwrapper.appendChild(desc);
                    container.appendChild(unitwrapper);       
                }

            }

            if (quizzing) {
                const finalResponseText = el ? el.dataset.text : "";
                valueEventEmitter.emit("quiz-ready", finalResponseText);
                quizzing = false;
            }

            if (el) el.removeAttribute("id");        }
    }
    
    if (data.type == "event") {
        console.log("event: ", data.event, data.payload);
    }
};

let quizzing = false;

functiontbd = async function() {
    // retrieve button phys unit
    const cbutton = event.currentTarget.textContent;
    console.log(cbutton);

    // retrieve phys unit progress
    const units = await window.electronAPI.storeGet('physics-units');
    const unitindex = units.indexOf(cbutton);
    console.log(unitindex);

    const unitsProgress = await window.electronAPI.storeGet('physics-units-progress');
    const physprogress = unitsProgress[unitindex];
    console.log(physprogress);

    // ask to finish last thing
    if (physprogress == "new") {
        console.log("Would you like to start with a quiz?");
        quizzing = true;

        console.log(await window.electronAPI.storeGet('physics-units-progress'));
        
        window.electronAPI.openQuizWindow();
        window.electronAPI.updateQuiz(`<h1 style="color: red;">Quiz: ${cbutton}</h1>`);

        window.electronAPI.updateQuiz(`<div id="unit-index"><h1 style="color: black;">${unitindex}</h1></div>`);

        // add loading
        window.electronAPI.updateQuiz(`<div id="loading"><h1 style="color: blue;">Loading...</h1></div>`);

        valueEventEmitter.once('quiz-ready', (quizText) => {
            let word = "";
            let qlist = []
            // remove loading message
            window.electronAPI.removeLoading();
            // toSlime.remove();
            for (c in quizText) {
                // split off questions and answers into different lists
                if (quizText[c] == "[") {
                    let qstart = true;
                } else if (quizText[c] == "]") {
                    let wordlist = [];
                    let w = "";
                    for (ch in word) {
                        if (word[ch] == "," || ch == word.length-1) {
                            if (ch == word.length-1) {
                                w += word[ch]
                            }
                            wordlist.push(w);
                            w = ""
                        } else {
                            w += word[ch];
                        }
                    }
                    qlist.push(wordlist);
                    word = "";
                } else {
                    word += quizText[c];
                }
            }
            console.log(qlist);
            let qPromptList = [];
            for (q in qlist) {
                qu = qlist[q];
                const divId = `quiz-${q}`;
                window.electronAPI.updateQuiz(
                    `<h1 style="color: brown;">${qu[0]}</h1><div id="${divId}"></div>`);
                
                let question = qu[0];
                window.electronAPI.onUpdateDiagnosticQuestionsData(question, q);
                qPromptList.push(question);
                
                for (let i = 1; i < qu.length; i++) {
                    console.log(qu[i]);
                    if (qu[i].includes("!!!")) {
                        console.log("ANSWER: " + qu[i]);
                        let tob = qu[i].slice(4);

                        window.electronAPI.updateQuizAnswers({
                            divId: divId,
                            button: {
                                text: tob,
                                isCorrect: true,
                                color: "red",
                            },
                        })
                        
                    } else {
                        window.electronAPI.updateQuizAnswers({
                            divId: divId,
                            button: {
                                text: qu[i],
                                isCorrect: false,
                                color: "red",
                            },
                        });
                    }
                }
            }

            console.log(qPromptList);
        });

        window.electronAPI.onTellRendererDiagnosticDone(async (event) => {
            console.log("FROM RENDERER TO WORK ON: " + await window.electronAPI.storeGet('topics-to-review'));
            promptOpenclaw("Ask me if I wanted to review these topics that I missed on the diagnostic check in a concise and readable manner, then follow up and ask what i'd like to learn more about. Don't use bullet points and format it readably: " + await window.electronAPI.storeGet('topics-to-review'));
        });

        window.electronAPI.onTellRendererUnitCorrect(async (a) => {
            console.log("UNIT CORRECT");
            const container = document.getElementById('unit-map');
            container.children[parseInt(a, 10) + 1].querySelector('button').style.backgroundColor = green_main;
            container.children[parseInt(a, 10) + 1].querySelector('button').style.borderColor = green_shadow;
            container.children[parseInt(a, 10) + 1].querySelector('span').textContent = "mastered";

            let pul = await window.electronAPI.storeGet('physics-units');
            const totalUnits = pul.length;
            console.log(totalUnits);
            const pb = document.getElementById("progress-bar-filled");
            console.log(pb);
            console.log(parseInt(pb.style.width.slice(0,-2), 10));
            const fill = parseInt(pb.style.width.slice(0,-2), 10) + 400/totalUnits;
            console.log(fill);
            pb.style.width = `${fill}px`;
        });

        const payload = {
            type: "req",
            id: String(crypto.randomUUID()),
            method: "chat.send",
            params: {
                sessionKey: "main",
                message: "I am fully new to this physics unit: " + cbutton + ". Generate a 4 question, diagnostic check of the topics covered by this unit. Format it exactly like so but vary which answer choice is correct. For the correct answer, start it with !!! and do not use commas within the question prompt, but put one after the question to seperate it from the first answer choice. Keep the questions college-board MCQ style. Example: [what color is the sky?, !!!blue, pink, green, purple]",
                idempotencyKey: String(crypto.randomUUID()),
            }
        };

        ws.send(JSON.stringify(payload));

        noHTML = true;

    // record score and update progress
    } else if (physprogress == 1) {
        console.log("It looks like you have already quizzed on this topic, would you like to try a mastery check?");
    }
}

const promptOpenclaw = function(msg) {
    const payload = {
        type: "req",
        id: String(crypto.randomUUID()),
        method: "chat.send",
        params: {
            sessionKey: "main",
            message: msg,
            idempotencyKey: String(crypto.randomUUID())
        }
    };
    ws.send(JSON.stringify(payload));
}

window.send = async function () {
    // store user input in msg
    const input = document.getElementById("input");
    const chat = document.getElementById("chat");
    const message = input.value;
    input.value = "";

    // update ui
    chat.innerHTML += `<div style="display: flex; justify-content: flex-end; background-color:rgba(0, 149, 255, 0.20); color:rgb(250, 250, 250); width: fit-content; border-color:rgba(250, 250, 250, 0); border: 1px solidrgba(250, 250, 250, 0); padding: 8px; margin: 5px 0; border-radius: 4px;">
        <div style="display: flex; justify-content: flex-end; width: fit-content; line-height:30px;"> <p style="margin: 0;"><b>you:</b> ${message}</p> </div>
        </div>`;
    const payload = {
        type: "req",
        id: String(crypto.randomUUID()),
        method: "chat.send",
        params: {
            sessionKey: "main",
            message: message,
            idempotencyKey: String(crypto.randomUUID())
        }
    };

    if (setup_incomplete) {
        if (need_username) {
            console.log('setting username: ' + message);

            await window.electronAPI.storeSet('username', message);

            console.log(await window.electronAPI.storeGet('username'));

            need_username = false;

            // prompt for physics level
            const chat = document.getElementById("chat");
            const row = document.createElement("div");
            row.className = "msg-row assistant";
            row.innerHTML = `<div style="background-color:rgba(78, 26, 26, 0.72); color: white; width: fit-content; padding: 8px; margin 5px 0; border-radius: 8px; float: left>
            <p style="margin: 0;"><b>assistant:</b> ${"Hello " + message + "! What level of physics are you studying? For example, AP Physics 1, Mechanics, Electricity&Magnetism, or whatever else you're working on!"}</p></div>`;
            chat.appendChild(row);
        } else if (need_physics_level) {
            // yap
            console.log('setting physics level: ' + message);
            await window.electronAPI.storeSet('physics-level', message);

            need_username = false;
            need_physics_level = false;
            // prompt for physics units
            const chat = document.getElementById("chat");
            const row = document.createElement("div");
            row.className = "msg-row assistant";
            row.innerHTML = `<div style="background-color: rgba(78, 26, 26, 0.72); color: white; width: fit-content; padding: 8px; margin 5px 0; border-radius: 4px;>
            <p style="margin: 0;"><b>assistant:</b> ${"Ok, I will generate a list of units we can cover for " + message}</p></div>`;
            chat.appendChild(row);

            promptOpenclaw("send just an exactly formatted list like so: item1,item2,item3,etc.. with no other text that just contains every relevant unit for this physics course: " + message + ". If a student says they are doing an AP physics course, use the official collegeboard units. Even if the course does not make sense, just add the default items kinematics and energy");
        }
        return;
    }

    // send msg to openclaw through websocket
    ws.send(JSON.stringify(payload));
};