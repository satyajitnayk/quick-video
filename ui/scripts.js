let localStream, remoteStream, peerConnection, ws;

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startButton = document.getElementById('startButton');
const endButton = document.getElementById('endButton');

// WebSocket endpoint URL
const wsEndpoint = 'ws://localhost:8080/ws';

// Connect to WebSocket server
function connectToWebSocket() {
  ws = new WebSocket(wsEndpoint);

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
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideo.srcObject = localStream;

    connectToWebSocket();

    peerConnection = new RTCPeerConnection();
    localStream
      .getTracks()
      .forEach((track) => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (event) => {
      remoteStream = event.streams[0];
      remoteVideo.srcObject = remoteStream;
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // send offer to backend using websocket
    ws.send(JSON.stringify({ type: 'offer', offer }));
  } catch (error) {
    console.error('Error accessing media devices or creating offer:', error);
  }
});

// End call
endButton.addEventListener('click', () => {
  localStream.getTracks().forEach((track) => track.stop());
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  if (peerConnection) {
    peerConnection.close();
  }

  if (ws) {
    ws.close();
  }
});
