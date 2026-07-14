// QRCode.js - Minimal QR Code generator for browser
// Simplified version for generating QR codes from tokens

function generateQRCodeCanvas(text, container, size) {
  // Use API to generate QR code image
  const canvas = document.createElement('canvas');
  canvas.width = size || 256;
  canvas.height = size || 256;
  canvas.id = 'qrImage';
  canvas.style.maxWidth = (size || 256) + 'px';
  
  const ctx = canvas.getContext('2d');
  
  // Use QR Server API to generate QR code
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = function() {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  img.src = 'https://api.qrserver.com/v1/create-qr-code/?data=' + encodeURIComponent(text) + '&size=' + (size || 256) + 'x' + (size || 256);
  
  container.appendChild(canvas);
  return canvas;
}

// Alternative: Generate QR code using inline SVG
function generateQRCodeSVG(text, container, size) {
  // Create SVG QR code placeholder
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", size || 256);
  svg.setAttribute("height", size || 256);
  svg.setAttribute("id", "qrImage");
  svg.style.border = '1px solid var(--border)';
  svg.style.borderRadius = '8px';
  svg.style.padding = '1rem';
  
  // Add text placeholder
  const textElement = document.createElementNS(svgNS, "text");
  textElement.setAttribute("x", "50%");
  textElement.setAttribute("y", "50%");
  textElement.setAttribute("text-anchor", "middle");
  textElement.setAttribute("font-size", "14");
  textElement.textContent = "QR: " + text.substring(0, 20) + "...";
  svg.appendChild(textElement);
  
  container.appendChild(svg);
  
  // Fetch actual QR code from API
  fetch('https://api.qrserver.com/v1/create-qr-code/?data=' + encodeURIComponent(text) + '&size=' + (size || 256) + 'x' + (size || 256))
    .then(response => response.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = function() {
        container.removeChild(svg);
        img.id = 'qrImage';
        img.style.maxWidth = (size || 256) + 'px';
        img.style.border = '1px solid var(--border)';
        img.style.borderRadius = '8px';
        img.style.padding = '1rem';
        container.appendChild(img);
      };
      img.src = url;
    })
    .catch(error => {
      console.error('Error fetching QR code:', error);
    });
}
