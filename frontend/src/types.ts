export type SearchItem = {
    id: string;
    type: string;
    title: string;
    url?: string | null;
};

export type Destination =
    | {
        mode: "append_to_selected";
        pageId: string;
        pageTitle?: string;
        pageUrl?: string;
        setAt: number;
    }
    | {
        mode: "append_to_child";
        parentPageId: string;
        parentTitle?: string;
        childPageId: string;
        childTitle?: string;
        childUrl?: string;
        setAt: number;
    };

export const DEST_KEY = "inline_destination_v1";

export type SWMessage =
    | {
        type: "SAVE_HIGHLIGHT";
        payload: {
            text: string;
            pageUrl: string;
            pageTitle?: string;
        };
    }
    | {
        type: "COMMENT_HIGHLIGHT";
        payload: {
            text: string;
            comment: string;
            pageUrl: string;
            pageTitle?: string;
        };
    };
