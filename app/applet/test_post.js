const URL = "https://script.google.com/macros/s/AKfycbwpzaN3dKKVMOuCt7NCg4-pI5o76Gl586zjvw1yQIDsi1XxIL8xacxvvPEidUycuA0/exec";
const p = {
  carType: "Test",
  odo: "1000",
  dist: 10,
  liters: "10",
  total: "50",
  station: "Test",
  tankLevel: "Full Tank - refresh",
  date: "2026-04-14",
  oil: ""
};

fetch(URL, {
  method: 'POST',
  body: JSON.stringify(p)
})
.then(async r => {
  console.log("Status:", r.status);
  console.log("Text:", await r.text());
})
.catch(e => console.error("Error:", e));
