First Data Funding Report PDF to XLSX
======================

We came across a need to transform the PDF provided by first data into a XLSX. The utility below does this with some caveats:

* It really only works for the year 2015
* The way in which it splits data apart is according to our needs, which might not neccesarily fit your use case. 

## Mode of operation

the extract.js script converts the PDF to text and then parses it out to find transaction with merchant reference numbers which contain parts of our own reference number - these are matches, transactions without reference numbers that we can identify go into "No Matches", and open sales/voids go into the Open Sales. 

## Using it!

Install the dependencies:
```bash
npm install
```

Execute the script with arguments for the pdf to extract and the output
```bash
node extract.js extract -f file.pdf -o file.xlsx
```