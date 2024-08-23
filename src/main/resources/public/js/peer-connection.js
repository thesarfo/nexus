export class PeerConnection {
    sdpExchange; // WebSocket with listeners for exchanging SDP offers and answers
    peerConnection; // RTCPeerConnection for exchanging media (with listeners for media and ICE)
    dataChannel; // RTCDataChannel for exchanging signaling and chat messages (with listeners)
    state; // NOT_CONNECTED, CONNECTING, CONNECTED, DISCONNECTED_SELF, DISCONNECTED_REMOTE
    options; // constructor args {onStateChange, onLocalMedia, onRemoteMedia, onChatMessage}
    localStream; // MediaStream from local webcam and microphone

    constructor(options) {
        this.options = options;
        this.init();
    }

    async init() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
            this.options.onLocalMedia(this.localStream);
        } catch (error) {
            alert("Failed to enable webcam and/or microphone, please reload the page and try again");
        }
        this.setState("NOT_CONNECTED");
        this.peerConnection = this.createPeerConnection();
        this.sdpExchange = this.createSdpExchange();
    }

    createSdpExchange() { // WebSocket with listeners for exchanging SDP offers and answers
        let ws = new WebSocket(`ws://${window.location.host}/api/matchmaking`);
        ws.addEventListener("message", (event) => {
            const message = JSON.parse(event.data);
            console.log("Received WebSocket message", message.name)
            if (message.name === "PARTNER_FOUND") this.handlePartnerFound(message.data);
            if (message.name === "SDP_OFFER") this.handleSdpOffer(JSON.parse(message.data));
            if (message.name === "SDP_ANSWER") this.handleSdpAnswer(JSON.parse(message.data));
            if (message.name === "SDP_ICE_CANDIDATE") this.handleIceCandidate(JSON.parse(message.data));
        });
        ws.addEventListener("close", async () => {
            while (this.sdpExchange.readyState === WebSocket.CLOSED) {
                console.log("WebSocket closed, reconnecting in 1 second");
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.sdpExchange = this.createSdpExchange();
            }
        });
        return ws;
    }

    createPeerConnection() { // RTCPeerConnection for exchanging media (with listeners for media and ICE)
        let conn = new RTCPeerConnection();
        conn.ontrack = event => {
            console.log(`Received ${event.track.kind} track`);
            this.options.onRemoteMedia(event.streams[0])
        };
        conn.onicecandidate = event => {
            if (event.candidate === null) { // candidate gathering complete
                console.log("ICE candidate gathering complete");
                return this.sdpExchange.send(JSON.stringify({name: "PAIRING_DONE"}));
            }
            console.log("ICE candidate created, sending to partner");
            let candidate = JSON.stringify(event.candidate);
            this.sdpExchange.send(JSON.stringify({name: "SDP_ICE_CANDIDATE", data: candidate}))
        };
        conn.oniceconnectionstatechange = () => {
            if (conn.iceConnectionState === "connected") {
                this.setState("CONNECTED");
                // ice candidates can still be added after "connected" state, so i need to log this with a delay
                setTimeout(() => console.log("WebRTC connection established"), 500);
            }
        };
        conn.ondatachannel = event => { // only for the "answerer" (the one who receives the SDP offer)
            console.log("Received data channel from offerer");
            this.dataChannel = this.setupDataChannel(event.channel)
        };
        return conn;
    }

    setupDataChannel(channel) { // RTCDataChannel for exchanging signaling and chat messages
        channel.onmessage = event => {
            console.log("Received data channel message", event.data);
            if (event.data === "BYE") {
                this.disconnect("REMOTE");
                return console.log("Received BYE message, closing connection");
            }
            this.options.onChatMessage(JSON.parse(event.data).chat);
        }
        return channel;
    }

    sendBye() {
        if (this.dataChannel === null) return console.log("No data channel");
        this.dataChannel.send("BYE");
        this.disconnect("LOCAL");
    }

    disconnect(orignator) {
        this.dataChannel = null;
        this.peerConnection.close();
        this.peerConnection = this.createPeerConnection();
        this.setState(`DISCONNECTED_${orignator}`);
    }

    setState(state) {
        this.state = state;
        this.options.onStateChange(state);
    }






}