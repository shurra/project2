import os

from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, send, join_room, leave_room

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
socketio = SocketIO(app)


channels = set()
online_users = []
channels_list = []


@app.route("/")
def index():
    return render_template("index.html")


@socketio.on("connect")
def on_connect():
    emit('channels', [c.name for c in channels], broadcast=True)
    # emit('users', online_users, broadcast=True)


@socketio.on("new channel")
def new_channel(data):
    # if not list(filter(lambda channel: channel['name'] == data['c_name'], channels)):
    print(f"New channel event, channels list = {channels}, new channel name = {data['c_name']}")
    # if len(channels) > 0:
    if data['c_name'] not in [c.name for c in channels]:
        # channels.append({"name": data['c_name']})
        channel = Channel(data['c_name'])
        channels.add(channel)
        print(f"Channel \"{channel.name}\"created ")
        # print(f"Channels list = {channels_list}")
        emit('channels', [c.name for c in channels], broadcast=True)


@socketio.on('join')
def on_join(data):
    print(f"Join start, data = {data}")
    username = data['user']
    user_gender = data['gender']
    room = data['room']
    # Create channel, if no exist
    if room not in [c.name for c in channels]:
        print(f"Channel \'{room}\' not exist, creating")
        new_channel({'c_name': room})
    join_room(room)
    print(f"{username} has entered the room {room}. User id = {request.sid}")
    # TODO: send channel messages to user joined
    print(f"Channels = {[channel.name for channel in channels]}")
    channel = find(channels, room)
    channel.add_user(username, user_gender)
    emit('users', channel.users, room=room)
    print(f"Channel: {channel.name}, joined users:{channel.users}")
    emit('messages', channel.messages, room=room)
    # emit('messages', json, namespace=room)
    # send(username + ' has entered the room.', room=room)


@socketio.on('leave')
def on_leave(data):
    username = data['user']
    room = data['room']
    # TODO: check, if user joined channel
    # if channels
    leave_room(room)
    channel = find(channels, room)
    try:
        channel.del_user(username)
        emit('users', channel.users, room=room)
    except:
        print("error delete user from channel")
    print(f"{username} has left the room {room}")
    # send(username + ' has left the room.', room=room)


@socketio.on('send post')
def on_send_post(data):
    print(f"post data = {data}")
    channel = find(channels, data['room'])
    channel.add_message({"user": data['user'], "time": data['time'], "text": data['text']})
    print(f"Channel name = {channel.name}. Channel messages = {channel.messages}")
    emit('post', {"user": data['user'], "time": data['time'], "text": data['text']}, room=data['room'])

class Channel:
    """Class for channels"""
    # __slots__ = ('name',)

    def __init__(self, name):
        self.name = name
        self.messages = [{"user": "admin", "time": "00:00", "text": f"Welcome to the {self.name}"}]
        self.users = []

    def add_message(self, message):
        self.messages.append(message)
        if len(self.messages) > 100:
            self.messages.pop(0)
        print(f"Messages length = {len(self.messages)}")

    def add_user(self, username, user_g):
        user_data = {"username": username, "user_g": user_g}
        if user_data not in self.users:
            self.users.append({"username": username, "user_g": user_g})

    def del_user(self, username):
        user_data = (item for item in self.users if item["username"] == username)
        print(f"User data for remove = {user_data}")
        if user_data in self.users:
            self.users.remove(user_data)


def find(list, value):
    """Return object with property name = value"""
    for item in list:
        if item.name == value:
            return item

"""Since all clients are assigned a personal room, to address a message to a single client, the session ID of the client can be used as the room argument."""