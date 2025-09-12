const fs = require('fs');
const csv = require('csv-parser');

const EMAIL_CSV_PATH = 'users.csv';

const emails = [];

exports.sender = async (req, res) => {

    fs.createReadStream(EMAIL_CSV_PATH)
        .pipe(csv({ headers: false }))
        .on('data', (row) => {
            const email = Object.values(row)[0]; 
            if (email) emails.push(email.trim());
        })
        .on('end', async () => {
            console.log(`Found ${emails.length} emails. Sending...`);
                console.log(emails);

                res.status(200).send(emails);
        });

}

