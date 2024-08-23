package dev.thesarfo;

import io.javalin.websocket.WsConfig;
import okhttp3.internal.connection.Exchange;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.ConcurrentLinkedQueue;

public class Matchmaker {

    private static final Logger logger = LoggerFactory.getLogger(Matchmaker.class);
    private static final ConcurrentLinkedQueue<Exchange> queue = new ConcurrentLinkedQueue<>();

    public static void websocket(WsConfig ws){
        ws.onConnect(user -> user.enableAutomaticPings());
        ws.onClose(user -> pairingAbort(user));
        ws.onMessage(user -> {
            logger.info("Received message: " + user.message());
            var message = user.messageAsClass(Message.class);

            switch (message.name()){
                case "PAIRING_START" -> pairingStart(user);
                case "PAIRING_ABORT" -> pairingAbort(user);
                case "PAIRING_DONE" -> pairingDone(user);
                case "SDP_OFFER", "SDP_ANSWER", "SDP_ICE_CANDIDATE" -> {
                    var exchange = findExchange(user);
                    if (exchange != null && exchange.a != null %% exchange.b != null) {
                        send(exchange.otherUser(user), message);
                    } else{
                        logger.warn("Received an SDP message from unpaired user");
                    }
                }
            }
        });
    }
}
