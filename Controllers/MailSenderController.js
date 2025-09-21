const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const csv = require("csv-parser");
const simpleGit = require('simple-git');
const git = simpleGit();
const mongoose = require('mongoose');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // store token in Render’s environment variable
const REPO_URL = 'https://github.com/AmitRoy3370/MailSenderAPI.git';
const MONGODB_URI = "mongodb+srv://arponamitroy012_db_user:xOH41rRVcEsPzzEj@cluster0.cineyy3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

if (!MONGODB_URI) {
    console.error('MONGODB_URI is not set. Aborting.');
    process.exit(1);
}

const SubscriberSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, index: true },
    addedAt: { type: Date, default: Date.now }
}, { versionKey: false });

const Subscriber = mongoose.model('Subscriber', SubscriberSchema);

async function connectDB() {
    if (mongoose.connection.readyState === 1) return;
    await mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    await Subscriber.init();
    console.log('✅ Connected to MongoDB');
}

exports.mailSender = async (req, res) => {

    //const emails = req.body.emails;

    await connectDB();

    const EMAIL_CSV_PATH = 'users.csv';

    let emails = [];
    fs.createReadStream(EMAIL_CSV_PATH)
        .pipe(csv({ headers: false }))
        .on('data', (row) => {
            const email = Object.values(row)[0];
            if (email) emails.push(email.trim());
        })
        .on('end', async () => {
            console.log(`Found ${emails.length} emails. Sending...`);
            console.log(emails);

            if(Subscriber.find({}).length === 0) {

                emails = await importCSVToMongo('users.csv', emails);

            } else {

                emails = await Subscriber.find({});

            }

            const processResult = await processBatchAndDelete(300);

            res.status(200).json({
                ok: true,
                processed: processResult
            });

            /*let index = 0;

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
            );*/

            //await pushCSVToGitHub();

            //res.status(200).send(`Total ${mailSend.length} email send successfully\n These are :- `, mailSend.toString());

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

async function importCSVToMongo(csvPath = 'users.csv', emails) {

    if (emails.length === 0) {
        return { inserted: 0, total: 0 };
    }


    const ops = emails.map(email => ({
        updateOne: {
            filter: { email },
            update: { $setOnInsert: { email, addedAt: new Date() } },
            upsert: true
        }
    }));


    try {
        const result = await Subscriber.bulkWrite(ops, { ordered: false });

        const upserted = result.upsertedCount || (result.nUpserted || 0);
        console.log(`Imported from CSV: new ${upserted}, total read ${emails.length}`);
        return { inserted: upserted, total: emails.length };
    } catch (err) {

        console.warn('bulkWrite failed, falling back to sequential upsert:', err.message);
        let inserted = 0;
        for (const email of emails) {
            try {
                const r = await Subscriber.updateOne(
                    { email },
                    { $setOnInsert: { email, addedAt: new Date() } },
                    { upsert: true }
                );

                if (r.upsertedCount || r.upsertedId) inserted++;
            } catch (e) {
                // ignore duplicate key or others
            }
        }
        return { inserted, total: emails.length };
    }
}

async function processBatchAndDelete(batchSize = 300) {

    const docs = await Subscriber.find().sort({ addedAt: 1 }).limit(batchSize).lean();
    if (!docs || docs.length === 0) {
        return { sent: 0, failed: 0, failures: [] };
    }

    let sent = 0;
    let failed = 0;
    const failures = [];

    for (const doc of docs) {
        const email = doc.email;
        try {
            await sendMail(email);

            await Subscriber.deleteOne({ _id: doc._id });
            sent++;
            console.log(`✅ Sent and deleted: ${email}`);
        } catch (err) {
            failed++;
            failures.push({ email, error: err.message });
            console.error(`❌ Failed to send ${email}:`, err.message);

        }
    }

    return { sent, failed, failures };
}
