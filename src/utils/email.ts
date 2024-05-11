import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import querystring from "querystring";
import axios from "axios";
import FormData from "form-data";
import * as fs from "fs";

const OAUTH_URL = "https://apigw-pr.telus.com/token";
const SCOPE = 2432;
const GRANT_TYPE = "client_credentials";
/**
 * Obtain an OAuth token.
 * @async
 * @returns {Promise<string>} - The OAuth token.
 * @throws {Error} Throws an error if there's an issue obtaining the token.
 */
const getOAuthToken = async (): Promise<string>=> {
    const client = new SecretManagerServiceClient();
    const gcpClientIdPath = "projects/47486989130/secrets/EMAIL_TOKEN_CLIENT_ID/versions/latest";
    const gcpClientSecretPath = "projects/47486989130/secrets/EMAIL_TOKEN_CLIENT_SECRET/versions/latest";

    const [emailClientIdSecret] = await client.accessSecretVersion({name: gcpClientIdPath});
    const [emailClientSecretSecret] = await client.accessSecretVersion({name: gcpClientSecretPath});

    const clientId = emailClientIdSecret?.payload?.data?.toString();
    const clientSecret = emailClientSecretSecret?.payload?.data?.toString();

    const authData = {
        grant_type: GRANT_TYPE,
        client_id: clientId,
        client_secret: clientSecret,
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
 * @param filepath - location of the attachment
 * @returns {Promise<void>}
 */
export const sendEmail = async (filepath: string): Promise<void> => {
    const emailList = process.env.EMAIL_LIST;
    const token = await getOAuthToken();
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
    await axios.request(config);
}
