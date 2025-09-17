const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const csv = require("csv-parser");
const simpleGit = require('simple-git');
const git = simpleGit();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // store token in Render’s environment variable
const REPO_URL = 'https://github.com/AmitRoy3370/MailSenderAPI.git';

exports.mailSender = async (req, res) => {

    //const emails = req.body.emails;

    const EMAIL_CSV_PATH = 'users.csv';

    const emails = [];
    fs.createReadStream(EMAIL_CSV_PATH)
        .pipe(csv({ headers: false }))
        .on('data', (row) => {
            const email = Object.values(row)[0];
            if (email) emails.push(email.trim());
        })
        .on('end', async () => {
            console.log(`Found ${emails.length} emails. Sending...`);
            console.log(emails);

            let index = 0;

            let restOfTheMail = [];
            let mailSend = [];

            for(const email of emails) {

                ++index;

                if(index < 301) {

                    await sendMail(email, res);
                    mailSend.push(email);

                } else {

                    restOfTheMail.push(email);

                }

            }

            if (fs.existsSync(EMAIL_CSV_PATH)) {
                fs.unlinkSync(EMAIL_CSV_PATH);
                console.log("🗑️ Deleted old users.csv");
            }

            fs.writeFileSync(
                EMAIL_CSV_PATH,
                restOfTheMail.join("\n"),
                "utf8"
            );

            await pushCSVToGitHub();

            res.status(200).send(`Total ${mailSend.length} email send successfully\n These are :- `, mailSend.toString());

        });

    //const response = await axios.get('http://127.0.0.1:3000/collectUsers');
    //const emails = response.data.emails;
    

};

async function sendMail(email, res) {

    const HTML_FILE_PATH = path.join(__dirname, '..', 'Assistance', 'MailBody.html');

    const htmlContent = fs.readFileSync(HTML_FILE_PATH, 'utf8');

    const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        auth: {
            user: '94695d001@smtp-brevo.com',
            pass: 'h1bMd0kn6N5G7py9'
        }
    });

    try {
        await transporter.sendMail({
            from: 'novixvpn@gmail.com',
            /*cc:'arponamitroy012@gmail.com',
            bcc:"priyaroy3370@gmail.com",*/
            to: email,
            subject: 'Upgrade Your Android with Novix VPN’s Free Update!',
            html: htmlContent
        });
        console.log(`✅ Sent to ${email}`);

        //res.status(200).send(htmlContent);

    } catch (err) {
        console.error(`❌ Failed to send to ${email}:`, err.message);
        //res.status(500).send(err.message);
    }
}

async function pushCSVToGitHub() {
    try {
        await git.addConfig('user.name', 'AmitRoy3370');
        await git.addConfig('user.email', 'arponamitroy012@gmail.com');
        await git.add('./users.csv');
        await git.commit('Update users.csv after email batch');

        await git.push([
            `https://${GITHUB_TOKEN}@github.com/AmitRoy3370/MailSenderAPI.git`,
            'HEAD:main'
        ]);
        console.log('✅ users.csv pushed to GitHub');
    } catch (err) {
        console.error('❌ Failed to push CSV to GitHub:', err.message);
    }
}