class StateSynchronizer {
  constructor() {
    this.io = null;
  }

  init(io) {
    this.io = io;
  }

  sendMatchUpdate(roomId, matchState) {
    if (this.io) {
      this.io.to(`match:${roomId}`).emit('match-update', matchState);
    }
  }

  sendMatchCompleted(roomId, payload) {
    if (this.io) {
      this.io.to(`match:${roomId}`).emit('match-completed', payload);
    }
  }

  sendOpponentDisconnected(roomId, userId) {
    if (this.io) {
      this.io.to(`match:${roomId}`).emit('opponent-disconnected', { userId });
    }
  }

  sendPlayerReconnected(roomId, userId, excludedSocketId) {
    if (this.io) {
      let target = this.io.to(`match:${roomId}`);
      if (excludedSocketId) target = target.except(excludedSocketId);
      target.emit('player-reconnected', { userId });
    }
  }

  sendOpponentLeft(roomId, message, excludedSocketId) {
    if (this.io) {
      let target = this.io.to(`match:${roomId}`);
      if (excludedSocketId) target = target.except(excludedSocketId);
      target.emit('opponent-left', { message });
    }
  }
}

// Export singleton instance
export default new StateSynchronizer();
