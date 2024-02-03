package main

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v3"
)

const (
	pongWait     = 10 * time.Second
	pingInterval = (pongWait * 9) / 10
)

type ClientList map[*Client]bool

type Client struct {
	connection *websocket.Conn
	manager    *Manager
	chatroom   string
	ergess     chan Event
	peerConn   *webrtc.PeerConnection
}

func NewClient(conn *websocket.Conn, manager *Manager) *Client {
	return &Client{
		connection: conn,
		manager:    manager,
		ergess:     make(chan Event),
	}
}

func (client *Client) readMessages() {
	fmt.Println("inside readmessages")
	defer func() {
		fmt.Println("closing readmessages")
		client.manager.removeClient(client)
	}()

	// ideally we should not get error here
	if err := client.connection.SetReadDeadline(time.Now().Add(pongWait)); err != nil {
		log.Println(err)
		return
	}

	client.connection.SetReadLimit(1024 * 20)

	client.connection.SetPongHandler(client.pongHandler)

	for {
		// ReadMessage is used to read the next message in queue in the connection
		_, payload, err := client.connection.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error reading message: %v", err)
				// TODO: Handle it properly
			}
			break
		}

		var request Event
		if err := json.Unmarshal(payload, &request); err != nil {
			log.Printf("error unmarshalling event: %v", err)
			break
		}

		if request.Type == EventSignalOffer || request.Type == EventSignalAnswer || request.Type == EventSignalCandidate {
			client.handleSignalMessage(request)
		} else {
			if err := client.manager.routeEvent(request, client); err != nil {
				log.Printf("error handeling message: %v", err)
			}
		}
	}
}

func (client *Client) writeMessages() {
	fmt.Println("inside writemessages")

	defer func() {
		fmt.Println("closing writemessages")
		client.manager.removeClient(client)
	}()

	// run a ticker that send ping msg to each client confirming if they are alive
	ticker := time.NewTicker(pingInterval)

	for {
		select {
		case message, ok := <-client.ergess:
			// check if egress channel is closed
			if !ok {
				if err := client.connection.WriteMessage(websocket.CloseMessage, nil); err != nil {
					log.Println("connection closed: ", err)
				}
				return
			}

			data, err := json.Marshal(message)
			if err != nil {
				// TODO: Handle error
				log.Println(err)
				return
			}

			if err := client.connection.WriteMessage(websocket.TextMessage, data); err != nil {
				log.Printf("failed to send message: %v", err)
			}
			log.Println("message sent")

		case <-ticker.C:
			log.Println("ping")
			// send ping to client
			if err := client.connection.WriteMessage(websocket.PingMessage, []byte(``)); err != nil {
				log.Println("write message error: ", err)
				return
			}
		}
	}
}

func (client *Client) pongHandler(pongMessage string) error {
	log.Println("pong")

	return client.connection.SetReadDeadline(time.Now().Add(pongWait))
}

func (client *Client) handleSignalMessage(event Event) {
	switch event.Type {
	case EventSignalOffer:
		client.handleOffer(event)
	case EventSignalAnswer:
		client.handleAnswer(event)
	case EventSignalCandidate:
		client.handleCandidate(event)
	default:
		// Unsupported message type
		log.Printf("Unsupported signal message type: %s\n", event.Type)
	}
}

// handleOffer handles the 'offer' WebRTC signaling event.
// It unmarshals the offer from the event payload, sets it as the remote description,
// creates an answer, sets it as the local description, marshals the answer into JSON,
// and sends it back to the client as a 'answer' signaling event.
func (client *Client) handleOffer(event Event) {

	// The offer represents the description of the remote peer's
	// media capabilities and settings
	offer := webrtc.SessionDescription{}

	type OfferPayload struct {
		Offer json.RawMessage `json:"offer"`
	}

	var offerPayload OfferPayload
	json.Unmarshal(event.Payload, &offerPayload)

	if err := json.Unmarshal(offerPayload.Offer, &offer); err != nil {
		log.Printf("Error unmarshalling offer: %v", err)
		return
	}

	// The remote description defines the configuration of the
	// remote peer's end of the connection.
	if err := client.peerConn.SetRemoteDescription(offer); err != nil {
		log.Printf("Error setting remote description for offer: %v", err)
		return
	}

	// An answer is the local peer's response to the offer.
	// It specifies the local media capabilities and settings.
	answer, err := client.peerConn.CreateAnswer(nil)
	if err != nil {
		log.Printf("Error creating answer: %v", err)
		return
	}

	// The local description defines the configuration of the
	// local peer's end of the connection.
	if err := client.peerConn.SetLocalDescription(answer); err != nil {
		log.Printf("Error setting local description for answer: %v", err)
		return
	}

	answerJSON, err := json.Marshal(answer)
	if err != nil {
		log.Printf("Error marshalling answer: %v", err)
		return
	}

	// sends the answer back to the client through the ergess channel
	// as a 'answer' signaling event.
	client.ergess <- Event{
		Type:    EventSignalAnswer,
		Payload: answerJSON,
	}
}

// handleAnswer handles the 'answer' WebRTC signaling event.
// It unmarshals the answer from the event payload and sets it as the remote description.
func (client *Client) handleAnswer(event Event) {
	answer := webrtc.SessionDescription{}
	// The answer is the remote peer's response to the client's offer.
	if err := json.Unmarshal(event.Payload, &answer); err != nil {
		log.Printf("Error unmarshalling answer: %v", err)
		return
	}

	if err := client.peerConn.SetRemoteDescription(answer); err != nil {
		log.Printf("Error setting remote description for answer: %v", err)
	}
}

// handleCandidate handles the 'candidate' WebRTC signaling event.
// It unmarshals the ICE candidate from the event payload and adds it to the peer connection.
func (client *Client) handleCandidate(event Event) {
	// ICE candidates are used to establish peer-to-peer connectivity over the network.
	// Handle ICE candidate message
	candidate := webrtc.ICECandidateInit{}
	json.Unmarshal(event.Payload, &candidate)

	// The ICE candidate contains information needed to establish a direct
	// connection between peers, such as IP addresses and ports.
	// Add ICE candidate to the peer connection
	if err := client.peerConn.AddICECandidate(candidate); err != nil {
		log.Printf("Error adding ICE candidate: %v", err)
	}

}

func (client *Client) setupWebRTC() {
	// Configuration for WebRTC
	config := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{
				URLs: []string{"stun:stun.l.google.com:19302"},
			},
		},
	}

	// create a new peerConnection
	peerConn, _ := webrtc.NewPeerConnection(config)
	client.peerConn = peerConn

	// Set up event handlers for ICE connection state change
	peerConn.OnICECandidate(func(candidate *webrtc.ICECandidate) {
		if candidate != nil {
			candidateJSON, _ := json.Marshal(candidate.ToJSON())
			client.ergess <- Event{
				Type:    EventSignalCandidate,
				Payload: candidateJSON,
			}
		}
	})

	// Add streams
	videoTrack, err := webrtc.NewTrackLocalStaticRTP(webrtc.RTPCodecCapability{MimeType: "video/vp8"}, "video", "pion")
	if err != nil {
		log.Println("Failed to create video track:", err)
		return
	}

	_, err = client.peerConn.AddTrack(videoTrack)
	if err != nil {
		log.Println("Failed to add video track:", err)
		return
	}

	// for audio stream
	audioTrack, err := webrtc.NewTrackLocalStaticRTP(webrtc.RTPCodecCapability{MimeType: "audio/opus"}, "audio", "pion")
	if err != nil {
		log.Println("Failed to create audio track:", err)
		return
	}

	_, err = client.peerConn.AddTrack(audioTrack)
	if err != nil {
		log.Println("Failed to add audio track:", err)
		return
	}
}
