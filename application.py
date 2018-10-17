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
    # if not data['c_name'] in [c.name for c in channels]:
    # channels.append({"name": data['c_name']})
    channel = Channel(data['c_name'])
    channels.add(channel)
    print(f"Channel \"{channel.name}\"created ")
    # print(f"Channels list = {channels_list}")
    emit('channels', [c.name for c in channels], broadcast=True)


# @socketio.on("user connected")
# def new_user(data):
#     print(f"new_user func start. username = {data}")
#     if data not in online_users:
#         print(f"Adding user {data} to list. ")
#         online_users.append(data)
#     emit('users', online_users, broadcast=True)


@socketio.on('join')
def on_join(data):
    print(f"Join start, data = {data}")
    username = data['user']
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
    channel.add_user(username)
    emit('users', channel.users, room=room)
    print(f"Channel: {channel.name}, joined users:{channel.users}")
    emit('messages', channel.messages, room=room)
    # emit('messages', json, namespace=room)
    send(username + ' has entered the room.', room=room)


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
    send(username + ' has left the room.', room=room)


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
        self.messages = [{"user": "admin", "time": "00:00", "text": f"Wellcome to the {self.name}"}]
        self.users = []

    def add_message(self, message):
        self.messages.append(message)
        self.messages = self.messages[:100]

    def add_user(self, username):
        if not username in self.users:
            self.users.append(username)

    def del_user(self, username):
        if username in self.users:
            self.users.remove(username)


def find(list, value):
    """Return object with property name = value"""
    for item in list:
        if item.name == value:
            return item

"""Since all clients are assigned a personal room, to address a message to a single client, the session ID of the client can be used as the room argument."""