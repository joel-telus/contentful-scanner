import { TranslationServiceClient } from '@google-cloud/translate';
import 'dotenv/config'
const projectId = process.env.GCP_PROJECT_ID;
const location = process.env.GCP_LOCATION;
const parent = `projects/${projectId}/locations/${location}`;

const translateClient = new TranslationServiceClient();

/**
 * Checks if the provided content is translated in the specified locale.
 * @param {string} content - The content to check for translation.
 * @param {string} locale - The target locale to check against.
 * @returns {Promise<boolean>} A boolean indicating whether the content is translated or not.
 *
 * @example
 * const result = await isContentTranslated("Bonjour", "fr");
 * console.log(result);  // Expected output: true
 */
export const isContentTranslated = async (content: string | undefined, locale: string): Promise<boolean> => {
    if (!content) return false;

    try {
        const [detection] = await translateClient.detectLanguage({
            parent,
            content,
            mimeType: 'text/plain',
        });

        const detectedLanguage = detection.languages?.[0]?.languageCode;
        return locale.includes(String(detectedLanguage));
    } catch (error) {
        console.error("Error detecting language:", error);
        return false;
    }
};

export const translateText = async (content: string, targetLanguage: string): Promise<string> => {
    // The max length of allowed text is 1024.
    if (content.length > 1024) {
        return "Text exceeds the maximum allowed length of 1024 characters";
    }

    try {
        const [translation] = await translateClient.translateText({
            parent,
            contents: [content],
            mimeType: 'text/plain', // or 'text/html'
            targetLanguageCode: targetLanguage,
        });

        return translation.translations?.[0]?.translatedText || "";
    } catch (error) {
        console.error("Error translating text:", error);
        return "Failed to translate";
    }
};
