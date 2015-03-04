(function(exports) {
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

    /**
     *
     * @returns {{reversals: Array, noMatches: Array, openSales: Array}}
     */
    parser.prototype.parse = function() {
        // Let's gather the day into lines we can worth with
        var collectedLines = [];
        var dataPackage = {
            reversals: [],
            noMatches: [],
            openSales: []
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

