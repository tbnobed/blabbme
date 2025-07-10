// Socket utility functions and types
export interface SocketMessage {
  type: string;
  [key: string]: any;
}

export function createSocketMessage(type: string, data: any = {}): string {
  return JSON.stringify({ type, ...data });
}

export function parseSocketMessage(data: string): SocketMessage | null {
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to parse socket message:", error);
    return null;
  }
}
