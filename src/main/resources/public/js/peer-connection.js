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


}