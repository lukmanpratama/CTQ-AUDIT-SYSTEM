const XLSX = require('xlsx');
const path = require('path');

const filePath = 'd:\\CTQ AUDIT SYSTEM\\Docs\\FORMAT TQC SEWING.xlsx';
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Get the array of arrays (first row usually contains headers)
const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
if (json.length > 0) {
    console.log("HEADERS FOUND:");
    console.log(JSON.stringify(json[0], null, 2));
    if (json.length > 1) {
        console.log("FIRST ROW DATA:");
        console.log(JSON.stringify(json[1], null, 2));
    }
} else {
    console.log("SHEET IS EMPTY");
}
