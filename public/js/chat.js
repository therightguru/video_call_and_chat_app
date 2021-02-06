var chatSocket = io('/'); //method available due to socket  io. variable for communicating.

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

chatSocket.on('connect', function(){
    var params = jQuery.deparam(window.location.search);
    chatSocket.emit('join', params, function(err){
        if(err){
            alert(err);
            window.location.href = '/';
        }else{
            console.log('No error');
        }
    })
});

chatSocket.on('disconnect', function(){
    console.log('Disconnected from the server!!'); 
});

chatSocket.on('updateUserList', function(users){
    var ol = jQuery('<ol></ol>');
    users.forEach(function(user){
        ol.append(jQuery('<li></li>').text(user));
    }); 

    jQuery('#users').html(ol);
});     

chatSocket.on('newMessage', function(message){

    var formattedTime = moment(message.createdAt).format('h:mm a');
    var template = jQuery('#message-template').html();
    var html = Mustache.render(template, {
        text: message.text,
        from: message.from,
        createdAt: formattedTime
    });
    jQuery('#messages').append(html);
    scrollToBottom(); 
});

chatSocket.on('newLocationMessage', function(message){
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

    chatSocket.emit('createMessage', {  
        text: messageTextbox.val()
    }, function(){
         messageTextbox.val('')
    }); 
});

var locationButton = jQuery('#send-location');
locationButton.on('click', function(e){
    e.preventDefault();
    if(!navigator.geolocation){
        return alert('Geolocation not supported by your browser!!');
    }

    locationButton.attr('disabled', 'disabled').text('Sending...');

    navigator.geolocation.getCurrentPosition(function(position){
        locationButton.removeAttr('disabled').text('Send Location');
        chatSocket.emit('createLocationMessage', {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
        });
    }, function(){
        locationButton.removeAttr('disabled').text('Send Location');
        alert('Unable to fetch location.');
    })
});