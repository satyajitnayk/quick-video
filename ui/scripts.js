let localStream, remoteStream, peerConnection, ws;

const videosContainer = document.getElementById('videos');
const localVideo = document.getElementById('localVideo');
const startButton = document.getElementById('startButton');
const endButton = document.getElementById('endButton');

// WebSocket endpoint URL
const wsEndpoint = 'ws://localhost:8080/ws';

// Connect to WebSocket server
function connectToWebSocket(roomId) {
  ws = new WebSocket(`${wsEndpoint}?roomID=${roomId}`);

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onmessage = async (event) => {
    const message = JSON.parse(event.data);
    if (message.type == 'offer') {
      await handleOffer(message.offer);
    } else if (message.type == 'candidate') {
      handleCandidate(message.candidate);
    }
  };
}

// Handle received offer
async function handleOffer(offer) {
  try {
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // Send answer to backend via WebSocket
    ws.send(JSON.stringify({ type: 'answer', answer }));
  } catch (error) {
    console.error('Error handling offer:', error);
  }
}

// Handle received ICE candidate
function handleCandidate(candidate) {
  try {
    peerConnection.addIceCandidate(candidate);
  } catch (error) {
    console.error('Error adding ICE candidate:', error);
  }
}

// Start call
startButton.addEventListener('click', async () => {
  const roomId = prompt('Enter room ID:');
  if (roomId) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localVideo.srcObject = localStream;

      connectToWebSocket(roomId);

      peerConnection = new RTCPeerConnection();
      localStream
        .getTracks()
        .forEach((track) => peerConnection.addTrack(track, localStream));

      // Handle incoming tracks
      peerConnection.ontrack = (event) => {
        const remoteVideoContainer = document.createElement('div');
        remoteVideoContainer.classList.add('remote-video'); // Add a class for styling

        const remoteVideo = document.createElement('video');
        remoteStream = event.streams[0];
        remoteVideo.srcObject = remoteStream;
        remoteVideo.autoplay = true;

        remoteVideoContainer.appendChild(remoteVideo);
        videosContainer.appendChild(remoteVideoContainer);
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // send offer to backend using websocket
      ws.send(JSON.stringify({ type: 'offer', offer }));
    } catch (error) {
      console.error('Error accessing media devices or creating offer:', error);
    }
  }
});

// End call
endButton.addEventListener('click', () => {
  localStream.getTracks().forEach((track) => track.stop());
  if (peerConnection) {
    peerConnection.close();
  }

  if (ws) {
    ws.close();
  }

  // Clear all remote video streams from the container
  const remoteVideos = document.querySelectorAll('.remote-video');
  remoteVideos.forEach((video) => video.remove());
});
