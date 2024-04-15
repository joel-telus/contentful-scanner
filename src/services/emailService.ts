import querystring from "querystring";
import axios from "axios";
import FormData from "form-data";
import * as fs from "fs";

interface IGetOAuthTokenProperties {
    CLIENT_ID: string;
    CLIENT_SECRET: string;
}

interface ISendEmailProperties {
    CLIENT_SECRET: string | undefined;
    CLIENT_ID: string | undefined;
    filepath: string;
}

const OAUTH_URL = "https://apigw-pr.telus.com/token";
const SCOPE = 2432;
const GRANT_TYPE = "client_credentials";

/**
 * Obtain an OAuth token.
 * @async
 * @param {IGetOAuthTokenProperties} params - The function parameters.
 * @returns {Promise<string>} - The OAuth token.
 * @throws {Error} Throws an error if there's an issue obtaining the token.
 */


const getOAuthToken = async ({ CLIENT_ID, CLIENT_SECRET }: IGetOAuthTokenProperties): Promise<string>=> {
    const authData = {
        grant_type: GRANT_TYPE,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope: SCOPE
    };

    const headers = {
        "Content-Type": "application/x-www-form-urlencoded"
    };

    try {
        const response = await axios.post(OAUTH_URL, querystring.stringify(authData), { headers });
        return response.data.access_token;
    } catch (error) {
        console.error("Error fetching OAuth token:", error);
        throw error;
    }
}

/**
 * Send an email with an attachment.
 * @async
 * @param {ISendEmailProperties} params - The function parameters.
 * @returns {Promise<void>}
 * @throws {Error} Throws an error if client credentials are missing or there's an issue sending the email.
 */
export const sendEmail = async ({ filepath, CLIENT_ID, CLIENT_SECRET }: ISendEmailProperties ): Promise<void> => {
    if (!CLIENT_SECRET || !CLIENT_ID){
        throw new Error("Client ID and secret are required");
    }
    const emailList = process.env.EMAIL_LIST;
    const token = await getOAuthToken({ CLIENT_ID, CLIENT_SECRET, });
    const subject = "Missing translations detected for Telus Shopfront";
    const bodyText = `
        <!DOCTYPE html>
        <html>
        <body>
        <p>Hi,</p>
        <p>Please find attached, the missing translations for Telus Business Marketplace.</p>
        <p>thanks.</p>
        </body>
        </html>
    `;

    let data = new FormData();
    data.append('from', "testing@telus.com");
    data.append('to', emailList);
    data.append('cc', "");
    data.append('subject', subject);
    data.append('bodyText', bodyText);
    data.append('isHtmlBody', 'true');
    data.append('attachment', fs.createReadStream(filepath));

    let config = {
        method: "post",
        maxBodyLength: Infinity,
        url: "https://apigw-public-yul-pr-002.cloudapps.telus.com/common/sendEmailProxy/v1/",
        headers: {
            ...data.getHeaders(),
            'Authorization': `Bearer ${token}`
        },
        data: data
    };

    try {
        await axios.request(config);
    } catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
}
