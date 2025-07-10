import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Download, Printer, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: {
    id: string;
    name?: string;
  };
}

export default function QRModal({ isOpen, onClose, room }: QRModalProps) {
  const [qrCode, setQrCode] = useState("");
  const [roomUrl, setRoomUrl] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && room) {
      const url = `${window.location.origin}/room/${room.id}`;
      setRoomUrl(url);
      
      // Fetch QR code from server
      fetch(`/api/rooms/${room.id}/qr`)
        .then(res => res.json())
        .then(data => {
          setQrCode(data.qrCode);
        })
        .catch(error => {
          console.error("Failed to generate QR code:", error);
        });
    }
  }, [isOpen, room]);

  const copyURL = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      toast({
        title: "URL copied",
        description: "Room URL has been copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy URL to clipboard",
        variant: "destructive",
      });
    }
  };

  const downloadQR = () => {
    if (!qrCode) return;

    const link = document.createElement('a');
    link.download = `room-${room.id}-qr.png`;
    link.href = qrCode;
    link.click();
  };

  const printQR = () => {
    if (!qrCode) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Room QR Code</title>
            <style>
              body { 
                text-align: center; 
                font-family: Arial, sans-serif;
                padding: 20px;
              }
              img { 
                max-width: 300px; 
                margin: 20px 0;
              }
              .room-info {
                margin-bottom: 20px;
              }
              .url {
                word-break: break-all;
                font-family: monospace;
                background: #f5f5f5;
                padding: 10px;
                border-radius: 5px;
                margin-top: 10px;
              }
            </style>
          </head>
          <body>
            <div class="room-info">
              <h2>Join Chat Room</h2>
              <p><strong>Room:</strong> ${room.name || room.id}</p>
              <div class="url">${roomUrl}</div>
            </div>
            <img src="${qrCode}" alt="QR Code" />
            <p>Scan with your phone to join the chat</p>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Share Room</DialogTitle>
        </DialogHeader>

        <div className="text-center">
          {/* QR Code */}
          <div className="w-48 h-48 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center mx-auto mb-4">
            {qrCode ? (
              <img src={qrCode} alt="QR Code" className="w-full h-full object-contain" />
            ) : (
              <div className="text-center">
                <QrCode className="text-gray-400 h-12 w-12 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Generating QR Code...</p>
              </div>
            )}
          </div>

          <div className="mb-4">
            <Label htmlFor="room-url" className="text-sm font-medium text-gray-700 mb-2 block">
              Room URL
            </Label>
            <div className="flex">
              <Input
                id="room-url"
                type="text"
                readOnly
                value={roomUrl}
                className="flex-1 rounded-r-none bg-gray-50"
              />
              <Button
                onClick={copyURL}
                className="bg-primary hover:bg-primary/90 rounded-l-none"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex space-x-2">
            <Button
              onClick={downloadQR}
              className="flex-1 bg-secondary hover:bg-secondary/90"
              disabled={!qrCode}
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button
              onClick={printQR}
              variant="outline"
              className="flex-1"
              disabled={!qrCode}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
