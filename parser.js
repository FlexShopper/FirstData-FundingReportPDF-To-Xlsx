(function(exports) {
    var async = require('async');
    var parser = function(data) {
        this._data = data;
    };


    function isNumber(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }

    /**
     * Given a line from the CSV parse the OPEN SALE|VOID
     * into a structure with meaning.
     * @param openSaleLine
     * @returns {{type: String, storeNumber: String, traceNumber: String, merchantRefNumber: String, checkNumber: String, checkDate: String, creditAmount: String}}
     */
    var parseOpenSale = function(openSaleLine) {
        openSaleLine = openSaleLine.split(' ').filter(function(data) {
            return data != ''
        });

        // OPEN SALE gets split into two, correct that...
        type = openSaleLine[0];
        data = openSaleLine.slice(1);
        if (type == 'OPEN') {
            type += ' ' + openSaleLine[1];
            data = openSaleLine.slice(2);
        }


        // Manual payments are also split into two, correct that..
        merchantRefNumber = data[2];
        if (data[2].replace(/[A-Z]/g, '') == data[2]) {
            merchantRefNumber = data[2] + ' ' + data[3];
            tmpContainer = data.slice(0, 2);
            tmpContainer = tmpContainer.concat([merchantRefNumber]);
            tmpContainer = tmpContainer.concat(data.slice(4));
            data = tmpContainer;
        }

        // Handle debit and credits correctly..
        debitAmount = 0;
        creditAmount = 0;
        if (data[6] != undefined) {
            debitAmount = data[5];
            creditAmount  = data[6];
        } else {
            creditAmount = data[5];
        }


        return {
            type              : type,
            storeNumber       : data[0],
            traceNumber       : data[1],
            merchantRefNumber : merchantRefNumber,
            checkNumber       : data[3],
            checkDate         : data[4],
            creditAmount      : creditAmount,
            debitAmount       : debitAmount
        };
    };

    var parseNoMatch = function(noMatchLine, callback) {
        noMatchChunks = noMatchLine.split('  ').filter(function(piece) {
            return piece != '';
        });

        returnStructure = {
            date: null,
            traceNumber: null,
            checkDate: null,
            procDate: null,
            firstName: null,
            lastName: null,
            merchantRefNumber: null,
            creditAmount: null,
            checkNumber: null,
            storeNumber: null
        };

        var merchantRefNumber = null;
        for (i = 0; i < noMatchChunks.length; i++) {
            chunk = noMatchChunks[i].trim();
            // The date
            if (chunk.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/)) {
                // Multiple dates but they always come in the same order
                if (returnStructure.date == null && i == 0) {
                    returnStructure.date = chunk;
                } else if (returnStructure.checkDate == null) {
                    returnStructure.checkDate = chunk;
                } else if (returnStructure.procDate == null) {
                    returnStructure.procDate = chunk;
                    // If we're at the procDate, the next column is store #...
                    i++;
                    returnStructure.storeNumber = noMatchChunks[i];

                }

            // Situations where the trace # and reference
            } else if (chunk.match(/\d{22}\s\d+/)) {
                refChunks = chunk.trim().split(' ');
                returnStructure.traceNumber = refChunks[0];
                i++;
                returnStructure.merchantRefNumber = refChunks[1] + ' ' + noMatchChunks[i];
                i++;
                returnStructure.checkNumber = noMatchChunks[i];

            // Situations where the trace numer has been traced by itself
            } else if (chunk.match(/\d{22}/)) {
                returnStructure.traceNumber = chunk;
            // Detecting name
            } else if (chunk.indexOf('CW: ') > -1) {
                nameChunks = chunk.split(' ').slice(1);
                returnStructure.lastName = nameChunks[0];
                returnStructure.firstName = nameChunks.splice(1).reverse().join(' ');

            // Here we're mostly likely dealing with the merchant ref Number
            // and the next one is the check # so we grab it here as well
            } else if (chunk.match(/\d+/)) {
                if (merchantRefNumber == null) {
                    i++;
                    merchantRefNumber = chunk + ' ' + noMatchChunks[i];
                    returnStructure.merchantRefNumber = merchantRefNumber;

                    i++;
                    returnStructure.checkNumber = noMatchChunks[i];
                }

            // Get the amount that this was for
            } else if (chunk.indexOf('$') >= -1) {
                returnStructure.creditAmount = chunk;
            }
        }

        callback(null, returnStructure);
    };

    var getNoMatches = function(noMatches, cb) {
        async.map(noMatches, parseNoMatch, function(err, results) {
            cb(results);
        });
    };

    /**
     *
     * @returns {{reversals: Array, noMatches: Array, openSales: Array, getNoMatches: Function}}
     */
    parser.prototype.parse = function() {
        // Let's gather the day into lines we can worth with
        var collectedLines = [];
        var dataPackage = {
            reversals: [],
            noMatches: [],
            openSales: [],
            getNoMatches: function(cb) {
                return getNoMatches(this.noMatches, cb)
            }
        };

        dataToScan = this._data;
        for (i = 0; i < dataToScan.length; i++) {
            lines = dataToScan[i].split('\n');
            for (a = 0; a < lines.length; a++) {
                if (lines[a].indexOf('OPEN SALE') > -1
                    || lines[a].indexOf('VOID') > -1) {
                    openSale = parseOpenSale(lines[a]);
                    if (openSale != undefined) {
                        dataPackage.openSales.push(openSale);
                    }
                    continue;
                }

                if (lines[a].indexOf('********') > -1) {
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
                    dataPackage.noMatches.push(chunk.join(' '));
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
            dataPackage.reversals.push({first_name: fName, last_name: lastName, error_message: errorMessage, reference_id: refId});
        }

        return dataPackage;
    };


    exports.newParser = function(data) {
        return new parser(data);
    };
})(module.exports);

