// start websocket
const ws = new WebSocket("ws://127.0.0.1:18789"); // TODO: replace with where you are running openclaw

let nonce = null;
let connected = false;

// check if websocket started
ws.onopen = () => {
    console.log("websocket started")
};

ws.onerror = (err) => {
    console.error("websocket error", err);
};

ws.onclose = (event) => {
    console.log("websocket closed", event.code, event.reason);
};

// if user sends message
ws.onmessage = (msg) => {
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
                    token: "OPENCLAW GATEWAY TOKEN".trim() //TODO: replace with your openclaw gateway token
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
                existing.innerHTML = `<div style="background-color: #210909; color: red; width: fit-content; border: 1px solid #fafafa; padding: 8px; margin 5px 0; border-radius: 4px;>
        <p style="margin: 0;"><b>assistant:</b> ${existing.dataset.text + payload.deltaText}</p></div>`
                existing.dataset.text += payload.deltaText;
            } else { // if response doesn't already exist make one
                const p = document.createElement("p");
                p.id = "assistant-last";
                p.dataset.text = payload.deltaText;
                p.innerHTML = `<div style="color: red; width: fit-content; border: 1px solid #000; padding: 8px; margin: 5px 0; border-radius: 4px;">
        <p style="margin: 0;"><b>assistant:</b> ${payload.deltaText}</p></div>`;
                chat.appendChild(p);
            }
        }
        
        // clear wip response if last chunk of openclaw response is sent
        if (payload.state === "final") {
            const el = document.getElementById("assistant-last");
            if (el) el.removeAttribute("id");
        }
    }
    
    if (data.type == "event") {
        console.log("event: ", data.event, data.payload);
    }
};

// handle user msg send
window.send = function () {
    // store user input in msg
    const input = document.getElementById("input");
    const chat = document.getElementById("chat");
    const message = input.value;
    input.value = "";

    // update ui
    chat.innerHTML += `<div style="float: right; background-color: #210909; color: #fafafa; width: fit-content; border-color: #fafafa; border: 1px solid #fafafa; padding: 8px; margin: 5px 0; border-radius: 4px;">
        <p style="margin: 0;"><b>you:</b> ${message}</p></div>`;
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

    // send msg to openclaw through websocket
    ws.send(JSON.stringify(payload));
};