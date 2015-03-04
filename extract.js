var inspect = require('eyes').inspector({maxLength:20000});
var pdfExtract = require('pdf-extract');
var fs = require('fs');
var excelbuilder = require('msexcel-builder');
var parser = require('./parser.js');

var argv = require('yargs')
    .usage('Usage: $0 <command> [options]')
    .command('extract', 'Extract the contents of a PDF into a usable XLSX')
    .demand(1)
    .example('$0 extract -f file.pdf -o file.xlsx', 'Convert the PDF to CSV')
    .demand('f')
    .demand('o')
    .alias('f', 'file')
    .alias('o', 'out-file')
    .nargs('f', 1)
    .nargs('o', 1)
    .describe('f', 'PDF to load')
    .describe('o', 'Outfile to write to')
    .help('h')
    .alias('h', 'help')
    .argv;


var pdfPath = argv.f;
var csvPath = argv.o;

var options = {type: 'text'};
var processor = pdfExtract(pdfPath, options, function(err) {
    if (err) {
        inspect(err);
    }
});


processor.on('complete', function(data) {
    p = parser.newParser(data.text_pages);
    data = p.parse();
    workbook = excelbuilder.createWorkbook('./', csvPath);
    if (data.openSales.length > 0) {
        var openSalesSheet = workbook.createSheet('Open Sales', 8, data.openSales.length + 1);
        openSalesSheet.set(1, 1, 'Type');
        openSalesSheet.set(2, 1, 'Store Number');
        openSalesSheet.set(3, 1, 'Trace Number');
        openSalesSheet.set(4, 1, 'Merchant Reference Number');
        openSalesSheet.set(5, 1, 'Check Number');
        openSalesSheet.set(6, 1, 'Check Date');
        openSalesSheet.set(7, 1, 'Credit Amount');
        openSalesSheet.set(8, 1, 'Debit Amount');
        for (i = 0; i < data.openSales.length; i++) {
            var oLine = data.openSales[i];
            var j = 0;
            for (k in oLine) {
                openSalesSheet.set(j+1, i+2, oLine[k]);
                j++;
            }
        }
    }

    if (data.reversals.length > 0) {
        var reversalsSheet = workbook.createSheet('Transactions', 4, data.reversals.length + 1);
        reversalsSheet.set(1, 1, 'First Name');
        reversalsSheet.set(2, 1, 'Last Name');
        reversalsSheet.set(3, 1, 'Error Message');
        reversalsSheet.set(4, 1, 'Reference Number');
        for (i = 0; i < data.reversals.length; i++) {
            var rLine = data.reversals[i];
            var r = 0;
            for (e in rLine) {
                reversalsSheet.set(r+1, i+2, rLine[e]);
                r++;
            }
        }
    }

    data.getNoMatches(function(noMatches) {
        var noMatchesSheet = workbook.createSheet('No Matches', 10, noMatches.length);
        for (i = 0; i < noMatches.length; i++) {
            var nLine = noMatches[i];
            var n = 0;
            for (e in nLine) {
                noMatchesSheet.set(n+1, i+1, nLine[e]);
                n++;
            }
        }

        workbook.save(function(ok) {
            if (ok || ok === null) {
                console.log('File saved successfully');
            } else {
                workbook.cancel();
                console.log('Failure saving file');
            }
        });
    });
});