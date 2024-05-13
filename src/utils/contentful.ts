import {createClient, Environment} from "contentful-management";
import { isContentTranslated, translateText } from "./translation";
import { ContentfulEnvironment, ContentfulLocale, TranslationsData } from "../types/global";
import { GCP_SECRET_TYPE, retrieveSecret } from "./gcp";

interface FetchAllEntriesProperties {
    contentTypeId: string;
    environment: Environment
}
interface ExtractContentFromArraysProperties {
    enContent: (string | unknown[])[];
    frContent: (string | unknown[])[];
    contentTypeId: string;
    entryId: string;
    fieldName: string;
    allEntries: TranslationsData[];
}
interface FetchAllEntriesReturn extends TranslationsData {}
interface FetchMissingTranslationsReturn extends TranslationsData {
    suggestedFrContent: string;
    linkToContent: string;
}
const excludedContentTypes = new Set(["assetWrapper", "udsIcons"])
const createContentfulClient = async () => {
    let accessToken;
    if (process.env.ENVIRONMENT === "development") {
        accessToken = process.env.CONTENTFUL_ACCESS_TOKEN
    }else {
        accessToken = await retrieveSecret(GCP_SECRET_TYPE.CONTENTFUL_ACCESS_TOKEN)
    }
    if (!accessToken) {
        throw new Error("Error retrieving contentful access token")
    }
    return createClient({ accessToken });
}
/**
 * Extracts content from arrays and handles nested arrays recursively.
 * @param {ExtractContentFromArraysProperties} params - The function parameters.
 */
const extractContentFromArrays = ({ enContent, frContent, contentTypeId, entryId, fieldName, allEntries }: ExtractContentFromArraysProperties) => {
    if (Array.isArray(enContent)) {
        for (let i = 0; i < enContent.length; i++) {
            if (Array.isArray(enContent[i])) {
                extractContentFromArrays({ enContent: enContent[i] as (string | unknown[])[], frContent: frContent?.[i] as (string | unknown[])[], contentTypeId, entryId, fieldName, allEntries });
            } else if (typeof enContent[i] === "string") {
                const data: TranslationsData = {
                    contentTypeId,
                    entryId,
                    field: fieldName,
                    enContent: enContent[i] as string,
                    frContent: (frContent?.[i] as string) || undefined
                };
                allEntries.push(data);
            }else {
                console.log("Contentful linktype", enContent[i]);
            }
        }
    } else {
        const data: TranslationsData = {
            contentTypeId,
            entryId,
            field: fieldName,
            enContent: enContent as string,
            frContent: frContent as unknown as string || undefined
        };
        allEntries.push(data);
    }
}

/**
 * Fetches all entries for a given content type from Contentful.
 * @async
 * @param {FetchAllEntriesProperties} params - The function parameters.
 * @returns {Promise<TranslationsData[]>} - Array of all entries.
 */
const fetchAllEntries = async ({ contentTypeId, environment }: FetchAllEntriesProperties): Promise<FetchAllEntriesReturn[]> => {
    const allEntries: FetchAllEntriesReturn[] = [];
    try {
        const contentType = await environment.getContentType(contentTypeId);
        let skip = 0;
        let total = 0;
        do {
            const entries = await environment.getEntries({
                content_type: contentTypeId,
                include: 10,
                limit: 1000,
                skip
            });
            total = entries.total;
            entries.items.forEach((entry) => {
                for (const fieldName in entry.fields) {
                    const fieldDefinition = contentType.fields.find(f => f.id === fieldName);
                    if (!fieldDefinition?.localized) continue;

                    const enContent = entry.fields[fieldName][ContentfulLocale.EN];
                    const frContent = entry.fields[fieldName][ContentfulLocale.FR_CA] || "";

                    if (typeof enContent === "string") {
                        allEntries.push({
                            contentTypeId,
                            entryId: entry.sys.id,
                            field: fieldName,
                            enContent,
                            frContent
                        });
                    }

                    if (Array.isArray(enContent)) {
                        extractContentFromArrays({
                            enContent,
                            frContent,
                            contentTypeId,
                            entryId: entry.sys.id,
                            fieldName,
                            allEntries
                        });
                    }
                }
            });
            skip += entries.limit;
        } while (skip < total);
    } catch (error) {
        console.error('Failed to fetch all entries:', error);
    }
    return allEntries;
};

/**
 * Fetches missing translations from Contentful.
 * Iterates over all content types and their entries to identify untranslated content.
 * @param spaceId - The id of the contentful space
 * @returns {Promise<TranslationsData[]>} - Array of entries with missing translations.
 */

export const fetchMissingTranslations = async (spaceId: string): Promise<FetchMissingTranslationsReturn[]> => {
    try {
        const contentfulClient = await createContentfulClient()
        const missingTranslations: FetchMissingTranslationsReturn[] = [];
        const space = await contentfulClient.getSpace(spaceId);
        const environment = await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT as ContentfulEnvironment);
        const contentTypes = await environment.getContentTypes();
        for (const contentType of contentTypes.items) {
            if (!excludedContentTypes.has(contentType.sys.id)) {
                const entries = await fetchAllEntries({ environment, contentTypeId: contentType.sys.id });
                for (const entry of entries) {
                    const isTranslated = await isContentTranslated(entry.frContent,  ContentfulLocale.FR_CA);
                    if (!isTranslated) {
                        const translatedContent = await translateText(entry.frContent, ContentfulLocale.FR_CA)
                        missingTranslations.push({...entry, suggestedFrContent: translatedContent, linkToContent: `https://app.contentful.com/spaces/${spaceId}/environments/${process.env.CONTENTFUL_ENVIRONMENT}/entries/${entry.entryId}`});
                    }
                }
            }
        }
        return missingTranslations;
    }
    catch (error) {
        throw new Error(String(error))
    }
}
