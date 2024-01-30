package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/pion/rtp"
	"github.com/pion/webrtc/v3"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Check the origin header and allow connections from trusted origins
		allowedOrigins := map[string]bool{
			"http://127.0.0.1:5500": true,
		}
		origin := r.Header.Get("Origin")
		return allowedOrigins[origin]
	},
}

func main() {
	http.HandleFunc("/ws", handleWebsocket)

	log.Println("Server is running on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func handleWebsocket(w http.ResponseWriter, r *http.Request) {

	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Failed to upgrade to websocket: ", err)
		return
	}
	defer conn.Close()

	// Create a new WebRTC peer connection configuration
	config := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{
				URLs: []string{"stun:stun.l.google.com:19302"},
			},
		},
	}

	// Create a new WebRTC peer connection
	peerConnection, err := webrtc.NewPeerConnection(config)
	if err != nil {
		log.Println("Failed to create WebRTC peer connection:", err)
		return
	}
	defer peerConnection.Close()

	// Set up event handlers for ICE candidates and session descriptions
	peerConnection.OnICECandidate(func(candidate *webrtc.ICECandidate) {
		if candidate == nil {
			return
		}
		// Send ICE candidate to the remote peer
		err := conn.WriteJSON(candidate.ToJSON())
		if err != nil {
			log.Println("Failed to write ICE candidate to WebSocket:", err)
		}
	})

	// peerConnection.OnNegotiationNeeded(func() {

	// 	// Create an offer to initiate the WebRTC session
	// 	offer, err := peerConnection.CreateOffer(nil)
	// 	if err != nil {
	// 		log.Println("Failed to create offer:", err)
	// 		return
	// 	}

	// 	// Set the local description of the peer connection
	// 	err = peerConnection.SetLocalDescription(offer)
	// 	if err != nil {
	// 		log.Println("Failed to set local description:", err)
	// 		return
	// 	}

	// 	// Send the SDP offer to the remote peer
	// 	err = conn.WriteJSON(offer)
	// 	if err != nil {
	// 		log.Println("Failed to write SDP offer to WebSocket:", err)
	// 	}
	// })

	peerConnection.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
		// Handle incoming media track
		log.Println("Received track:", track.ID())

		// Create a channel to read RTP packets from the track
		packets := make(chan *rtp.Packet)

		// Start reading RTP packets from the track
		go func() {
			defer close(packets)
			for {
				packet, _, readErr := track.ReadRTP()
				if readErr != nil {
					log.Println("Failed to read RTP packet:", readErr)
					return
				}
				packets <- packet
			}
		}()

		// Create a new track to process the incoming media
		newTrack, trackErr := webrtc.NewTrackLocalStaticRTP(track.Codec().RTPCodecCapability, track.ID(), track.StreamID())
		if trackErr != nil {
			log.Println("Failed to create new track:", trackErr)
			return
		}

		// Add the new track to the peer connection
		if _, addTrackErr := peerConnection.AddTrack(newTrack); addTrackErr != nil {
			log.Println("Failed to add track to peer connection:", addTrackErr)
			return
		}

		// Start forwarding packets to the new track
		go func() {
			for packet := range packets {
				// Write the received RTP packet to the new track
				if writeErr := newTrack.WriteRTP(packet); writeErr != nil {
					log.Println("Failed to write RTP packet to new track:", writeErr)
					return
				}
			}
		}()
	})

	peerConnection.OnDataChannel(func(d *webrtc.DataChannel) {
		// Handle incoming data channel
	})

	// Create a data channel for non-media communication
	// _, err = peerConnection.CreateDataChannel("data", nil)
	// if err != nil {
	// 	panic(err)
	// }

	// Handle WebSocket messages
	for {
		var msg map[string]interface{}
		err := conn.ReadJSON(&msg)
		if err != nil {
			log.Println("Failed to read message from WebSocket:", err)
			break
		}

		switch msg["type"] {
		case "offer":
			// Handle SDP offer from remote peer
			offer := webrtc.SessionDescription{}
			err := parseJSON(msg["offer"], &offer)
			if err != nil {
				log.Println("Failed to parse offer:", err)
				break
			}

			err = peerConnection.SetRemoteDescription(offer)
			if err != nil {
				log.Println("Failed to set remote description:", err)
				break
			}

			// Create answer
			answer, err := peerConnection.CreateAnswer(nil)
			if err != nil {
				log.Println("Failed to create answer:", err)
				break
			}

			err = peerConnection.SetLocalDescription(answer)
			if err != nil {
				log.Println("Failed to set local description:", err)
				break
			}

			// Send answer to remote peer
			err = conn.WriteJSON(answer)
			if err != nil {
				log.Println("Failed to write answer to WebSocket:", err)
			}

		case "candidate":
			// Handle ICE candidate from remote peer
			candidateInit := webrtc.ICECandidateInit{}
			err := parseJSON(msg["candidate"], &candidateInit)
			if err != nil {
				log.Println("Failed to parse ICE candidate:", err)
				break
			}

			// Add ICE candidate to peer connection
			err = peerConnection.AddICECandidate(candidateInit)
			if err != nil {
				log.Println("Failed to add ICE candidate:", err)
			}
		}
	}
}

func parseJSON(data interface{}, target interface{}) error {
	// Convert data directly to JSON bytes
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	// Unmarshal JSON bytes into the target interface
	return json.Unmarshal(jsonData, target)
}
