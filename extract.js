var inspect = require('eyes').inspector({maxLength:20000});
var pdfExtract = require('pdf-extract');
var fs = require('fs');
var csv = require('fast-csv');
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
    // Let's gather the day into lines we can worth with
    var collectedLines = [];
    dataToScan = data.text_pages;
    for (i = 0; i < dataToScan.length; i++) {
        lines = dataToScan[i].split('\n');
        for (a = 0; a < lines.length; a++) {
            if (lines[a].indexOf('OPEN SALE') > -1
                || lines[a].indexOf('VOID') > -1
                || lines[a].indexOf('********') > -1) {
                continue;
            }

            if ((
                    (
                        lines[a].indexOf('\/2015') >= 0
                        && lines[a].indexOf('$') >= 0
                    )
                    || lines[a].indexOf('CW: ') > -1
                )
                && lines[a].indexOf('to 02') == -1 ){
                collectedLines.push(lines[a]);
            }
        }
    }

    // Group into customer chunks...
    collectedLines = collectedLines.splice(2);
    chunks = [];
    for (i = 0; i < collectedLines.length; i++) {
        data = [];
        data.push(collectedLines[i]);
        i++;
        data.push(collectedLines[i]);
        chunks.push(data);
    }

    // Go over chunks and extract customer data
    for (i = 0; i < chunks.length; i++) {
        chunk = chunks[i];

        // Get the referenceId for the transaction
        refIdMatches = chunk[0].match(/\s5\w{11}/);
        refId = null;
        if (refIdMatches == null) {
            if (noMatchFile != undefined) {
                fs.appendFile(noMatchFile, chunk.join(' ') + "\n\n");
            }
            continue;
        } else {
            refId = refIdMatches[0].toString().trim();
        }

        // Get the name and error message for the customer
        chunkParts = chunk[1].split(' ');
        lastName = '';
        fName    = [];
        assignToName = true;
        errorMessage = '';
        for (j = 0; j < chunkParts.length; j++) {
            if (chunkParts[j] != '') {
                if (chunkParts[j].indexOf('2015') > -1) {
                    continue;
                }

                if (chunkParts[j] == 'CW:') {
                    j++;
                    lastName = chunkParts[j];
                    assignToName = true;
                    continue;
                }

                if (assignToName) {
                    fName.push(chunkParts[j]);
                } else {
                    errorMessage += chunkParts[j] + ' ';
                }
            } else {
                assignToName = false;
            }
        }


        fName = fName.join(' ');
        errorMessage = errorMessage.trim();
        csvStream.write({first_name: fName, last_name: lastName, error_message: errorMessage, reference_id: refId});
    }

    csvStream.end();
});