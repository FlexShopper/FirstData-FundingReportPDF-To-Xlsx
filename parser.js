var parser = function(data) {
    this._data = data;
};

module.exports.newParser = parser;

parser.prototype.parse = function() {
    // Let's gather the day into lines we can worth with
    var collectedLines = [];
    var dataPackage = [];
    dataToScan = this._data;
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
        dataPackage.push({first_name: fName, last_name: lastName, error_message: errorMessage, reference_id: refId});
    }

    return dataPackage;
};

