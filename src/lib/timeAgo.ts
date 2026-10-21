export const formatAgo = (thenMs: number, nowMs: number = Date.now()): string => {
  const minutes = Math.max(Math.floor((nowMs - thenMs) / 60000), 0);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
};
