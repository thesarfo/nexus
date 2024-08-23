package dev.thesarfo;

import io.javalin.Javalin;
import io.javalin.http.staticfiles.Location;


public class NexusMain
{
    public static void main( String[] args )
    {
        Javalin.create(config -> {
            config.staticFiles.add("src/main/resources/public", Location.EXTERNAL);
            config.router.mount(router -> router.ws("/api/matchmaking", Matchmaker::websocket));
        }).start(7070);
    }
}
