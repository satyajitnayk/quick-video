package handlers

import (
	"quick-video/pkg/chat"
	w "quick-video/pkg/webrtc"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
)

func ChatRoom(c *fiber.Ctx) error {
	return c.Render("chat", fiber.Map{}, "layouts/main")
}

func ChatRoomWS(c *websocket.Conn) {
	uuid := c.Params("uuid")
	if uuid == "" {
		return
	}

	w.RoomLock.Lock()
	room := w.Rooms[uuid]
	w.RoomLock.Unlock()
	if room == nil {
		return
	}
	if room.Hub == nil {
		return
	}

	chat.PeerChatConn(c.Conn, room.Hub)
}

func chatStreamWS(c *websocket.Conn) {
	suuid := c.Params("suuid")
	if suuid == "" {
		return
	}

	w.RoomLock.Lock()
	if stream, ok := w.Streams[suuid]; ok {
		w.RoomLock.Unlock()
		if stream.Hub == nil {
			hub := chat.NewHub()
			stream.Hub = hub
			go hub.Run()
		}
		chat.PeerChatConn(c.Conn, stream.Hub)
		return
	}
	w.RoomLock.Unlock()
}
