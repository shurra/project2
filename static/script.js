const myStorage = window.localStorage;
var username;


document.addEventListener('DOMContentLoaded', () => {
    console.log("Page loaded. Start JS.");
//Templates for channel in channels list and user in users list
    var channel_list_item = Handlebars.compile(document.querySelector('#channel_list_item').innerHTML);
    var users_list_item = Handlebars.compile(document.querySelector('#users_list_item').innerHTML);
    var messages_list_item = Handlebars.compile(document.querySelector('#messages_list_item').innerHTML);
    // Connect to websocket
    var socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);

    //If not user in local storage, open login form:
    if(!myStorage.getItem('username') || myStorage.getItem('username') === "") {
        //Listener for Login button
        const loginForm = document.querySelector('#loginForm');
        loginForm.getElementsByTagName('button')[0].onclick = () => {
            const new_user = loginForm.getElementsByTagName('input')[0].value.trim();
            if (new_user && new_user !== "") {
                myStorage.setItem('username', new_user);
                document.querySelector('.user-menu_username').innerHTML = new_user;
                // close Login Form
                document.querySelector('#loginForm').style.display = 'none';
            }
            else alert("Please enter your name");
        };
        //Listener for Enter key on input tag
        loginForm.getElementsByTagName('input')[0].addEventListener('keyup', function(event) {
            if (event.key === "Enter") {
                // saveUser();
                loginForm.getElementsByTagName('button')[0].click();
            }
        });
        //Show login form
        document.querySelector('#loginForm').style.display = 'block';
    } else {
        username = myStorage.getItem('username');
        document.querySelector('.user-menu_username').innerHTML = username;
    }

    // When connected, configure buttons
    socket.on('connect', () => {
        console.log("Connected...");
        //TODO: If channel in local storage, create that channel after server restart
        // new channel button
        const new_channel_button = document.querySelector('#new_channel');
        new_channel_button.addEventListener('click', () => {
            var c_name = new_channel_button.parentNode.querySelector('input').value.trim();
            new_channel_button.parentNode.querySelector('input').value = "";
            if(!c_name.match(/^[0-9a-zA-Z]{1,16}$/)) {
                alert('Illegal channel name. Only alphanumeric symbols allowed (max 16).');
            }
            if (c_name) {
                socket.emit('new channel', {'c_name': c_name});
                //join that channel after creation
                join_channel(c_name, username)
            }
        });
        //Enter key on text input for new channel
        new_channel_button.parentNode.querySelector('input').addEventListener('keyup', (event) => {
            if (event.key === "Enter") {
                new_channel_button.click();
            }
        });
        //disable message input before join
        document.querySelector(".input-box_text").disabled = true;
        //join saved channel after page load
        if (myStorage.getItem('current_channel')) {
            join_channel(myStorage.getItem('current_channel'), myStorage.getItem('username'));
        }
    });
    //Receive channels update
    socket.on('channels', (data) => {
        console.log("Channels received", data)
        channels_list(data);
    });
    //Receive users update
    socket.on('users', (data) => {
        console.log("Users received ", data);
        users_list(data);
    });

    //Receive channels messages on joining channel
    socket.on('messages', (data) =>{
        // console.log("messages received =", data);
        messages_list(data);
    });

    //Receive message (post) in joined channel
    socket.on('post', (data) => {
        console.log("new message received", data);
        show_message(data);
    });

    function show_message(message) {
        console.log("---message received: ", message);
        document.querySelector('.message-history').innerHTML += messages_list_item({'messages': [message]});
    }

    function messages_list(messages) {
        console.log("messages received =", messages);
        console.log(document.querySelector('.message-history'));
        document.querySelector('.message-history').innerHTML = messages_list_item({'messages': messages});
    }

    function channels_list(channels) {
        document.querySelector('#channels_list').innerHTML = channel_list_item({'channels': channels});
        //Listeners for channels names
        document.querySelector('#channels_list').querySelectorAll('li').forEach((item) => {
            // console.log(item.dataset.chname);
            item.addEventListener('click', () => {
                if (myStorage.getItem('current_channel') === item.dataset.chname) {
                    return null
                }
                join_channel(item.dataset.chname, username);
                // console.log("Channel = ", item.dataset.chname);
                document.querySelector('#channels_list').querySelectorAll('li').forEach((item) => {
                    item.classList.remove('active');
                });
                item.classList.add('active');
                // document.querySelector('.channel-menu_name').innerHTML = "# " + item.dataset.chname;
            });
            if (item.dataset.chname === myStorage.getItem('current_channel')) {
                item.classList.add('active');
            }
            // console.log(item, typeof(item))
        })
    }

    function join_channel(channel, user) {
        //TODO: create channel and join, if channel in local storage, and not in server channels

        // Leave current channel, if joined
        console.log("saved channel = ", myStorage.getItem('current_channel'), "new channel = ", channel);
        if (myStorage.getItem('current_channel')) {
            socket.emit('leave', {room: myStorage.getItem('current_channel'), user: user});
        }
        myStorage.setItem('current_channel', channel);
        socket.emit('join', {room: channel, user: user});
        var message_input = document.querySelector('.input-box_text');
        message_input.disabled = false;
        message_input.addEventListener('keyup', (event) => {
            if (event.key === "Enter" && message_input.value.length > 0) {
                console.log(message_input.value);
                var time = Date.now();
                // console.log("Current time = ", time);
                // console.log("Current time = ", new Date(time).getHours(), ":");
                socket.emit('send post', {room: myStorage.getItem('current_channel'), user: user, time: time, text: message_input.value});
                message_input.value = "";
            }
        });
        // console.log("joined room = ", io.sockets.manager.roomClients[socket.id])
        document.querySelector('.channel-menu_name').innerHTML = "# " + channel;
    }

    function users_list(users) {
        document.querySelector('#users_list').innerHTML = users_list_item({'users': users});
    }
});
