package server

import (
	"flag"
	"os"
	"time"

	"quick-video/internal/handlers"
	w "quick-video/pkg/webrtc"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/template/html/v2"
	"github.com/gofiber/websocket/v2"
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

	engine := html.New("./views", ".html")

	app := fiber.New(fiber.Config{Views: engine})
	app.Use(logger.New())
	app.Use(cors.New())

	app.Get("/", handlers.Welcome)
	app.Get("/room/create", handlers.CreateRoom)
	app.Get("/room/:uuid", handlers.Room)
	app.Get("/room/:uuid/ws", websocket.New(handlers.RoomWS, websocket.Config{
		HandshakeTimeout: 10 * time.Second,
	}))
	app.Get("/room/:uuid/chat", handlers.ChatRoom)
	app.Get("/room/:uuid/chat/ws", websocket.New(handlers.ChatRoomWS))
	app.Get("/room/:uuid/viewer/ws", websocket.New(handlers.ViewRoomWS))
	app.Get("/stream/:suuid", handlers.Stream)
	app.Get("/stream/:suuid/ws", websocket.New(handlers.StreamWS, websocket.Config{
		HandshakeTimeout: 10 * time.Second,
	}))
	app.Get("/stream/:suuid/chat/ws", websocket.New(handlers.ChatStreamWS))
	app.Get("/stream/:suuid/viewer/ws", websocket.New(handlers.StreamViewerWS))
	app.Static("/", "./assets")

	w.Rooms = make(map[string]*w.Room)
	w.Streams = make(map[string]*w.Room)

	go func() {
		for range time.NewTicker(time.Second * 3).C {
			for _, room := range w.Rooms {
				room.Peers.DispatchKeyFrame()
			}
		}
	}()

	// check certificates
	if *cert != "" {
		return app.ListenTLS(*addr, *cert, *key)
	}
	return app.Listen(*addr)

}
