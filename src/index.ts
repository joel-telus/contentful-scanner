import { HttpFunction } from "@google-cloud/functions-framework";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { fetchMissingTranslations } from "./services/contentfulService";
import { createObjectCsvWriter } from "csv-writer";
import { sendEmail } from "./services/emailService";

const csvHeader = [
  {id: "contentTypeId", title: "CONTENT_TYPE_ID"},
  {id: "entryId", title: "ENTRY_ID"},
  {id: "field", title: "FIELD"},
  {id: "content_EN_US", title: "CONTENT_EN_US"},
  {id: "content_FR_CA", title: "CONTENT_FR_CA"}
]
const csvFilePath = "missing_translations.csv";
const csvWriter = createObjectCsvWriter({
  header: csvHeader,
  path: csvFilePath
});

const client = new SecretManagerServiceClient();

interface IRequestBody {
  spaceId: string;
  scanAllEntries: boolean;
}


export const app: HttpFunction = async (req, res) => {
  const { spaceId, scanAllEntries } = req.body as IRequestBody;

// Define secret paths.
  const contentfulAccessTokenPath = "projects/47486989130/secrets/CONTENTFUL_ACCESS_TOKEN/versions/latest";
  const emailTokenClientIdPath = "projects/47486989130/secrets/EMAIL_TOKEN_CLIENT_ID/versions/latest";
  const emailTokenClientSecretPath = "projects/47486989130/secrets/EMAIL_TOKEN_CLIENT_SECRET/versions/latest";

// Fetch the secrets.
  const [contentfulSecret] = await client.accessSecretVersion({name: contentfulAccessTokenPath});
  const [emailClientIdSecret] = await client.accessSecretVersion({name: emailTokenClientIdPath});
  const [emailClientSecretSecret] = await client.accessSecretVersion({name: emailTokenClientSecretPath});

// Extract the payloads from the secrets.
  const contentfulAccessToken = contentfulSecret?.payload?.data?.toString();
  const emailTokenClientId = emailClientIdSecret?.payload?.data?.toString();
  const emailTokenClientSecret = emailClientSecretSecret?.payload?.data?.toString();


  if (scanAllEntries) {
    const missingTranslations = await fetchMissingTranslations({spaceId, contentfulAccessToken});
    await csvWriter.writeRecords(missingTranslations);
    await sendEmail({ filepath: csvFilePath, CLIENT_ID: emailTokenClientId, CLIENT_SECRET: emailTokenClientSecret});
    return res.status(200).send("Missing translations sent!");
  }

  res.status(400).send("Invalid Request!");
};
