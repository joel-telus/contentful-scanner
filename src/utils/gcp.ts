import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

export enum GCP_SECRET_TYPE {
    CONTENTFUL_ACCESS_TOKEN = 'CONTENTFUL_ACCESS_TOKEN',
    EMAIL_TOKEN_CLIENT_ID = 'EMAIL_TOKEN_CLIENT_ID',
    EMAIL_TOKEN_CLIENT_SECRET = 'EMAIL_TOKEN_CLIENT_SECRET'
}

export const retrieveSecret = async (secretId: GCP_SECRET_TYPE): Promise<string | null> => {
    const client = new SecretManagerServiceClient();
    try {
        let path = "";
        switch (secretId) {
            case GCP_SECRET_TYPE.CONTENTFUL_ACCESS_TOKEN:
                path = "projects/47486989130/secrets/CONTENTFUL_ACCESS_TOKEN/versions/latest";
                break;
            case GCP_SECRET_TYPE.EMAIL_TOKEN_CLIENT_ID:
                path = "projects/47486989130/secrets/EMAIL_TOKEN_CLIENT_ID/versions/latest";
                break;
            case GCP_SECRET_TYPE.EMAIL_TOKEN_CLIENT_SECRET:
                path = "projects/47486989130/secrets/EMAIL_TOKEN_CLIENT_SECRET/versions/latest";
                break;
        }
        const [secret] = await client.accessSecretVersion({ name: path });
        return secret?.payload?.data?.toString() || null;
    } catch (error) {
        console.error(`Failed to retrieve secret for ${secretId}:`, error);
        return null;
    }
}

