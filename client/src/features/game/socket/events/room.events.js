import { toast } from 'sonner';

export const registerRoomEvents = (connectionManager, { onOpponentLeft }) => {
  const unsubOpponentLeft = connectionManager.subscribe('opponent-left', ({ message }) => {
    toast.info(message || 'Your opponent has left the match');
    onOpponentLeft?.();
  });

  return () => {
    unsubOpponentLeft();
  };
};
