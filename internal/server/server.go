package server

import (
	"flag"
	"os"
)

var (
	addr = flag.String("addr", ":"+os.Getenv("PORT"), "")
	cert = flag.String("cert", "", "")
	key  = flag.String("key", "", "")
)

func Run() error {
	flag.Parse()

	if *addr == ":" {
		*addr = ":8080"
	}

	app.Get("/", handlers.Welcome)
	app.Get("/room/create", handlers.CreateRoom)
	app.Get("/rom/:uuid", handlers.Room)
	app.Get("/room/:uuid/ws")
	app.Get("/room/:uuid/chat", handlers.ChatRoom)
	app.Get("/room/:uuid/chat/ws", ws.New(handlers.ChatRoomWS))
	app.Get("/room/:uuid/viewer/ws", ws.New(handlers.ViewRoomWS))
	app.Get("/stream/:suuid", handlers.Stream)
	app.Get("/strea/:suuid/ws")
	app.Get("/stream/:suuid/chat/ws")
	app.Get("/stream/:suuid/viewer/ws")
}
