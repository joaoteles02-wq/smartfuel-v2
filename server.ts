import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import xml2js from "xml2js";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for parsing NF-e
  app.post("/api/parse-nf", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      console.log("Parsing NF-e URL:", url);
      
      // Try to fetch the URL content
      const response = await fetch(url);
      const text = await response.text();
      
      // Check if it's XML
      if (text.includes("<?xml") || text.includes("<nfeProc")) {
        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(text);
        
        // Extract total (vNF) - common path: nfeProc.NFe.infNFe.total.ICMSTot.vNF
        const vNF = result?.nfeProc?.NFe?.infNFe?.total?.ICMSTot?.vNF || 
                    result?.NFe?.infNFe?.total?.ICMSTot?.vNF;
        
        if (vNF) {
          return res.json({ total: vNF, success: true });
        }
      }
      
      // Fallback: Use Regex on text if it's HTML or some other format
      // NF-e portals often have vNF in the page
      const vnfMatch = text.match(/vNF[>=](\d+[\.,]\d+)/i) || text.match(/Valor Total[^\d]+(\d+[\.,]\d+)/i);
      if (vnfMatch) {
         const total = vnfMatch[1].replace(',', '.');
         return res.json({ total, success: true });
      }

      res.json({ success: false, message: "Could not auto-extract total, but link was processed." });
    } catch (error) {
      console.error("Error parsing NF:", error);
      res.status(500).json({ error: "Failed to parse NF-e" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
