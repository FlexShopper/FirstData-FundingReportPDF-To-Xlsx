var inspect = require('eyes').inspector({maxLength:20000});
var pdfExtract = require('pdf-extract');
var fs = require('fs');
var csv = require('fast-csv');
var parser = require('./parser.js');

var argv = require('yargs')
    .usage('Usage: $0 <command> [options]')
    .command('extract', 'Extract the contents of a PDF into a usable CSV and optionally route unmatchable payments to another file')
    .demand(1)
    .example('$0 extract -f file.pdf -o file.csv [-n no-matches.txt]', 'Convert the PDF to CSV')
    .demand('f')
    .demand('o')
    .alias('f', 'file')
    .alias('o', 'out-file')
    .alias('n', 'no-match-file')
    .nargs('f', 1)
    .nargs('o', 1)
    .nargs('n', 1)
    .describe('f', 'PDF to load')
    .describe('o', 'Outfile to write to')
    .help('h')
    .alias('h', 'help')
    .argv;


var pdfPath = argv.f;
var csvPath = argv.o;
var noMatchFile = argv.n;

var csvStream = csv.createWriteStream({headers: true});
var writableStream = fs.createWriteStream(csvPath);

csvStream.pipe(writableStream);

var options = {type: 'text'};
var processor = pdfExtract(pdfPath, options, function(err) {
    if (err) {
        inspect(err);
    }
});


processor.on('complete', function(data) {
    p = parser.newParser(data);
    console.log(p);
});