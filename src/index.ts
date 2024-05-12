import { HttpFunction } from "@google-cloud/functions-framework";
import { fetchMissingTranslations } from "./utils/contentful";
import { createObjectCsvWriter } from "csv-writer";
import { sendEmail } from "./utils/email";
interface RequestBody {
  spaceId: string;
  scanAllEntries: boolean;
}

const csvHeader = [
  {id: "contentTypeId", title: "CONTENT_TYPE_ID"},
  {id: "entryId", title: "ENTRY_ID"},
  {id: "field", title: "FIELD"},
  {id: "enContent", title: "CONTENT_EN_US"},
  {id: "frContent", title: "CONTENT_FR_CA"},
]
const csvFilePath = "missing_translations.csv";
const csvWriter = createObjectCsvWriter({
  header: csvHeader,
  path: csvFilePath
});
export const app: HttpFunction = async (req, res) => {
  const { spaceId, scanAllEntries } = req.body as RequestBody;
  try {
    if (scanAllEntries) {
      const missingTranslations = await fetchMissingTranslations(spaceId);
      await csvWriter.writeRecords(missingTranslations);
      await sendEmail(csvFilePath);
      return res.status(200).send("Missing translations sent!");
    }
  }
  catch (err) {
    res.status(500).send(err);
  }
  res.status(400).send("Invalid Request!");
};
