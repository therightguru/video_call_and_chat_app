const socket = io('/')
const videoGrid = document.getElementById('video-grid')
const teacherVideo = document.getElementById('teacher-video')

// First we get the viewport height and we multiple it by 1% to get a value for a vh unit
let vh = window.innerHeight * 0.01;
// Then we set the value in the --vh custom property to the root of the document
document.documentElement.style.setProperty('--vh', `${vh}px`);

const genId = () => {
  return Math.floor(Math.random() * Math.floor(Math.random() * Date.now()))
}

// const myPeer = new Peer(JOINED_USER, {
//   secure: true,
//   host: '0.peerjs.com',
//   port: '443',
//   config: { 'iceServers': [
//     { 'urls': 'stun:stun.therightguru.com:3478' },
//     { 'urls': 'turn:turn.therightguru.com:3478', 'username': 'admin', 'credential': 'therightguru' }
//   ],'sdpSemantics': 'unified-plan' }
// })

const myPeer = new Peer(JOINED_USER, {
  secure: true,
  host: 'trg-live-class.herokuapp.com',
  port: '443',
  config: { 'iceServers': [
    { 'urls': 'stun:stun.therightguru.com:3478' },
    { 'urls': 'turn:turn.therightguru.com:3478', 'username': 'admin', 'credential': 'therightguru' }
  ],'sdpSemantics': 'unified-plan' }
})

// let django_socket = new WebSocket(`ws://localhost:8000/ws/video_call/edustart/`)
const myVideo = document.createElement('video')
myVideo.muted = true
const peers = {}
let callStream
var audioEnabled = true
var videoEnabled = true
navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(stream => {
  callStream = stream
  if(JOINED_USER.includes("TC_")) {
    addVideoStreamTeacher(myVideo, stream)
  } else {
    addVideoStream(myVideo, stream)
  }

  myPeer.on('call', call => {
    call.answer(stream)
    const video = document.createElement('video')
    video.id = call.metadata.from.replace("%20", " ")
    call.on('stream', userVideoStream => {
      console.log("After: ", userVideoStream.getAudioTracks(), userVideoStream.getVideoTracks())
      if(call.metadata.from.includes("TC_")) {
        addVideoStreamTeacher(video, userVideoStream)
      } else {
        addVideoStream(video, userVideoStream)
      }
    })
    peers[call.peer] = call
  })

  socket.on('user-connected', (joinedUser, userId) => {
    // connectToNewUser(joinedUser, userId, stream)
    setTimeout(() => {
      connectToNewUser(joinedUser, userId, stream)
    }, 3000)
  })
})

socket.on('user-disconnected', userId => {
  if (peers[userId]) {
    peers[userId].close()
  }
})

myPeer.on('open', id => {
  socket.emit('join-room', ROOM_ID, JOINED_USER, id)
})

function connectToNewUser(joinedUser, userId, stream) {
  const call = myPeer.call(userId, stream, {metadata: {"from": window.location.href.split("&")[1]}})
  const video = document.createElement('video')
  video.id = joinedUser
  call.on('stream', userVideoStream => {
    if(joinedUser.includes("TC_")){
      addVideoStreamTeacher(video, userVideoStream)
    } else {
      addVideoStream(video, userVideoStream)
    }
  })
  call.on('close', () => {
    video.remove()
  })
  peers[userId] = call
  // peers[userId] = { call, joinedUser }
}

function addVideoStream(video, stream) {
  video.srcObject = stream
  video.controls = true;
  video.addEventListener('loadedmetadata', () => {
    video.play()
  })
  videoGrid.append(video)
}

function addVideoStreamTeacher(video, stream) {
  video.srcObject = stream
  video.controls = true;
  video.addEventListener('loadedmetadata', () => {
    video.play()
  })
  teacherVideo.append(video)
}

// Toggle audio
document.getElementById("muteButton")
  .addEventListener("click", function() {
    if(callStream){
      audioEnabled = !audioEnabled
      callStream.getAudioTracks()[0].enabled = audioEnabled
      console.info("Mute Button running")
    }
  })

// Toggle video
document.getElementById("videoButton")
  .addEventListener("click", function() {
    if(callStream){
      videoEnabled = !videoEnabled
      callStream.getVideoTracks()[0].enabled = videoEnabled
      console.info("Video Button running")
    }
})


// Share screen
document.getElementById("shareScreen")
  .addEventListener("click", function() {
    navigator.mediaDevices.getDisplayMedia({cursor:true})
    .then(screenStream=>{
      console.log(Object.values(peers))
      Object.values(peers).map(peer => {
        peer.peerConnection?.getSenders().map(sender => {
            if(sender.track.kind == "video") {
              sender.replaceTrack(screenStream.getVideoTracks()[0])
              .then(res => console.log(res));
            }
        })
      });
      myVideo.srcObject=screenStream
      myVideo.controls = false

      screenStream.getTracks()[0].onended = () => {
        Object.values(peers).map(peer => {
          peer.peerConnection?.getSenders().map(sender => {
              if(sender.track.kind == "video") {
                sender.replaceTrack(callStream.getVideoTracks()[0]);
              }
          })
        });
        myVideo.srcObject=callStream
        myVideo.controls = true
      }
  })
})

// Screen Recording
let recorder, recordStream;
const startRecord = document.getElementById("screenRecord");
const stopRecord = document.getElementById("stopRecord");
async function startRecording() {
    recordStream = await navigator.mediaDevices.getDisplayMedia({
      video: { mediaSource: "screen" }
    });

    recorder = new MediaRecorder(recordStream);
    const chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);

    recorder.onstop = e => {
      const completeBlob = new Blob(chunks, { type: chunks[0].type });
      console.log(URL.createObjectURL(completeBlob));

      // DOWNLOAD
      // const a = document.createElement("a")
      // a.style.display = "none";
      // a.href = URL.createObjectURL(completeBlob);
      // a.download = 'test.mp4';
      // document.body.appendChild(a);
      // a.click();
      // setTimeout(() => {
      //   document.body.removeChild(a);
      // }, 100);

      // SEND TO AWS S3
      AWS.config.update({ region: confRegion });
      const S3_BUCKET = confBucketName;
      const s3 = new AWS.S3({
        accessKeyId: confAccessKeyId,
        secretAccessKey: confSecretAccessKey,
        region: confRegion
      });

      var videoFile = new File([completeBlob],   (new Date()).toISOString() + "_" + JOINED_USER.replace("_at_", "@").replace(/ /g, ".") + '.webm');
      const s3Params = {
        Bucket: S3_BUCKET,
        Key: "class_video/" + videoFile.name,
        Body: videoFile,
        ContentType: videoFile.type,
        ACL: "public-read",
      };

      s3.putObject(s3Params, function(err, data) {
          if (err) {
              console.log(" Error while  UPLOADING Video :");
          } else {
              console.log(" Success UPLOADING Video: ", data);
          }
      });
    };

    recorder.start();
}

startRecord.addEventListener("click", () => {
  startRecord.setAttribute("disabled", true);
  stopRecord.removeAttribute("disabled");

  startRecording();
});

stopRecord.addEventListener("click", () => {
  stopRecord.setAttribute("disabled", true);
  startRecord.removeAttribute("disabled");

  recorder.stop();
  recordStream.getVideoTracks()[0].stop();
});

let classStatusUpdated = false;
async function updateClassStatus(newStatus) {
  if(!ROOM_ID.includes("trial_")) {
    const classUpdated = await fetch(`https://therightguru.com/api/update-class-status/${ROOM_ID}`, {
      method: 'PATCH',
      headers: {
        "Content-type": "application/json"
      },
      body: JSON.stringify({ class_status: newStatus })
    })
    
    if(classUpdated.status == 201) {
      alert("Class status updated. Now you can end call.");
      classStatusUpdated = true;
    }
  } else {
    const classUpdated = await fetch(`https://therightguru.com/api/update-trial-class-status/${ROOM_ID.slice(6)}`, {
      method: 'PATCH',
      headers: {
        "Content-type": "application/json"
      },
      body: JSON.stringify({ class_status: newStatus })
    })
    
    if(classUpdated.status == 201) {
      alert("Class status updated. Now you can end call.");
      classStatusUpdated = true;
    }
  }
  
}

// Remove video on direct closing of browser
window.addEventListener('beforeunload', function(e) {
  e.preventDefault();
  socket.emit('removeVideo', {
    removeUser: JOINED_USER,
    text: "User closed tab/browser directly"
  });
});

// End Call
document.getElementById("endCall")
  .addEventListener("click", function() {
    if (JOINED_USER.includes("ES_")){
      myPeer.destroy()
      window.location.replace("https://therightguru.com/student-live-class-rating/" + JOINED_USER.replace("_at_", "@").replace(/ /g, ".") + "/" + ROOM_ID)
    } else if (JOINED_USER.includes("TC_")) {
      if(classStatusUpdated) {
        myPeer.destroy()
        if(ROOM_ID.includes("trial_")) {
          window.location.replace("https://therightguru.com/teacher-live-class-rating/" + JOINED_USER.replace("_at_", "@").replace(/ /g, ".") + "/" + ROOM_ID) 
        } else {
          window.location.replace("https://therightguru.com/teacher-dashboard") 
        }
      } else alert("Please update class status first.")
    } else if (JOINED_USER.includes("TS_")) {
      myPeer.destroy()
      window.location.replace("https://therightguru.com/student-trial-class-rating/" + JOINED_USER.replace("_at_", "@").replace(/ /g, ".") + "/" + ROOM_ID)
    } else {
      myPeer.destroy()
      window.location.replace("https://therightguru.com")
    }
    
    // socket.current.emit('close',{to:caller})
  })

// User Verification for Class
window.onload = function() {
  verifyAttendee();
}

const verifyAttendee = () => {
  if(JOINED_USER.includes("@")) {
    alert("You are not allowed to join this class. Please refrain from joining this class.")
    window.location.replace("https://therightguru.com");
  } else {
    fetch(`https://therightguru.com/api/validate-candidate/${ROOM_ID}/${JOINED_USER.replace("_at_", "@").replace(/ /g, ".")}`)
    .then(res => res.json())
    .then(data => {
      console.log(data);

      if(data.validated === "false") {
        alert("You are not allowed to join this class. Please refrain from joining this class.")
        window.location.replace("https://therightguru.com");
      }
      // if(localStorage.getItem("unique") != JOINED_USER.replace("_at_", "@").replace(/ /g, ".").slice(3)) {
      //   alert("You are not logged into your student portal. Please login to join class.")
      //   window.location.replace("https://therightguru.com");
      // } else if(data.validated === "false") {
      //   alert("You are not allowed to join this class. Please refrain from joining this class.")
      //   window.location.replace("https://therightguru.com");
      // }
    })
    .catch(err => console.log(err))
  }
}

// JavaScript for chat functionality 

function scrollToBottom(){
  var messages = jQuery('#messages');
  var newMessage = messages.children('li:last-child');

  var clientHeight = messages.prop('clientHeight');
  var scrollTop = messages.prop('scrollTop');
  var scrollHeight = messages.prop('scrollHeight');
  var newMessageHeight = newMessage.innerHeight();
  var lastMessageHeight = newMessage.prev().innerHeight();

  if(clientHeight + scrollTop + newMessageHeight + lastMessageHeight >= scrollHeight){
      messages.scrollTop(scrollHeight);
  }
}

socket.on('connect', function(){
  var params = jQuery.deparam(window.location.search);
  socket.emit('join', {name: JOINED_USER, room: ROOM_ID}, function(err){
      if(err){
          alert(err);
          window.location.href = '/';
      }else{
          console.log('No error');
      }
  })
});

socket.on('disconnect', function(){
  console.log('Disconnected from the server!!');
});

socket.on('updateUserList', function(users){
  var tol = jQuery('<ol></ol>');
  var sol = jQuery('<ol></ol>');
  users.forEach(function(user){
    if(user.includes("TC")) {
      tol.append(jQuery('<li></li>').text(user));
    } else {
      sol.append(jQuery('<li></li>').text(user));
    }
  });

  jQuery('#susers').html(sol);
  jQuery('#tusers').html(tol);
});

let on_message_tab = false;

socket.on('newMessage', function(message){

  var formattedTime = moment(message.createdAt).format('h:mm a');
  var template = jQuery('#message-template').html();
  var html = Mustache.render(template, {
      text: message.text,
      from: message.from,
      createdAt: formattedTime
  });
  jQuery('#messages').append(html);
  scrollToBottom(); 

  var myDiv = document.getElementById("chat");
  myDiv.scrollTop = myDiv.scrollHeight;

  if(on_message_tab) {
    document.getElementById("red-dot").style.display = "none";
  }
  else {
    document.getElementById("red-dot").style.display = "block";
  }
});

socket.on('newLocationMessage', function(message){
  var formattedTime = moment(message.createdAt).format('h:mm a');
  var template = jQuery('#location-template').html();
  var html = Mustache.render(template, {
      from: message.from,
      url: message.url,
      createdAt: formattedTime
  });
  jQuery('#messages').append(html);
  scrollToBottom();
});

jQuery('#message-form').on('submit', function(e){
  e.preventDefault();

  var messageTextbox = jQuery('[name=message]');

  socket.emit('createMessage', {  
      text: messageTextbox.val()
  }, function(){
       messageTextbox.val('')
  }); 
});

var isHandRaised = false;
document.getElementById("hand-raise")
  .addEventListener("click", function() {
    isHandRaised = !isHandRaised;
    if(isHandRaised) {
      socket.emit('raiseHand', {
        raisedBy: JOINED_USER.replace("_at_", "@").replace(/ /g, "."),
        text: "Hand raised by student"
      });
    }
  });

socket.on('handRaised', function(message) {

  var mess = jQuery('<p></p>');
  mess.append(message);
  jQuery('#myPopup').html(mess);

  var popup = document.getElementById('myPopup');
  popup.classList.add('show');

  setTimeout(function(){
    document.getElementById('myPopup').classList.remove('show');
  }, 5000);

})

socket.on('videoRemoved', function(message){
  const video = document.getElementById(message.removeUser)
  video.remove()

})

var locationButton = jQuery('#send-location');
locationButton.on('click', function(e){
  e.preventDefault();
  if(!navigator.geolocation){
      return alert('Geolocation not supported by your browser!!');
  }

  locationButton.attr('disabled', 'disabled').text('Sending...');

  navigator.geolocation.getCurrentPosition(function(position){
      locationButton.removeAttr('disabled').text('Send Location');
      socket.emit('createLocationMessage', {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
      });
  }, function(){
      locationButton.removeAttr('disabled').text('Send Location');
      alert('Unable to fetch location.');
  })
});
