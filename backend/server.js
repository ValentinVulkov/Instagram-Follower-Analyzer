const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const app = express();
app.use(cors());
console.log('ALo');
app.get('/analyze', (req, res) => {
    try {
        console.log('ALo');
        // 1. Find the ZIP file in the current directory
        const files = fs.readdirSync(__dirname);
        const zipName = files.find(f => f.endsWith('.zip'));

        if (!zipName) {
            return res.status(404).json({ error: "No .zip file found. Please put your Instagram export in the backend folder." });
        }

        // 2. Open the outer ZIP
        let zip = new AdmZip(path.join(__dirname, zipName));
        let zipEntries = zip.getEntries();

        // 3. Check if this is a wrapper ZIP containing another ZIP inside
        //    (e.g. backend.zip containing instagram-username-date.zip)
        const innerZipEntry = zipEntries.find(e => 
            e.entryName.endsWith('.zip') && e.entryName.includes('instagram')
        );

        if (innerZipEntry) {
            // Extract the real Instagram ZIP from memory and re-open it
            const innerZipBuffer = innerZipEntry.getData();
            zip = new AdmZip(innerZipBuffer);
            zipEntries = zip.getEntries();
        }

        // 4. Extract username from whichever zip had "instagram-" in its name
        const instagramZipName = innerZipEntry 
            ? path.basename(innerZipEntry.entryName) 
            : zipName;
        const zipParts = instagramZipName.replace('.zip', '').split('-');
        const username = zipParts.slice(1, -3).join('-') || zipParts[1] || "User";

        // 5. Find the follower/following JSON entries
        const followersEntry = zipEntries.find(e => e.entryName.endsWith('followers_1.json'));
        const followingEntry = zipEntries.find(e => e.entryName.endsWith('following.json'));

        if (!followersEntry || !followingEntry) {
            return res.status(404).json({ error: "Required JSON files missing inside ZIP structure." });
        }

        // 6. Parse JSON
        const followersRaw = JSON.parse(followersEntry.getData().toString('utf8'));
        const followingRaw = JSON.parse(followingEntry.getData().toString('utf8'));

        // 7. Extract usernames
        const followersList = followersRaw.map(item =>
            item.string_list_data?.[0]?.value
        ).filter(Boolean);

        const followingList = followingRaw.relationships_following.map(item =>
            item.title
        ).filter(Boolean);

        // 8. Find who you follow that doesn't follow back
        const followersSet = new Set(followersList);
        const result = followingList.filter(user => !followersSet.has(user));

        res.json({
            accountHolder: username,
            followersCount: followersList.length,
            followingCount: followingList.length,
            notFollowingBackCount: result.length,
            users: result
        });
        print('ALo');
    } catch (err) {
        console.error("Analysis Error:", err);
        res.status(500).json({ error: "Internal server error during analysis.", details: err.message });
    }
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Backend is running on http://localhost:${PORT}`);
    console.log(`Test it here: http://localhost:${PORT}/analyze`);
});