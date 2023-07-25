import { Locator, Page, Response } from "playwright";

export type LocatorCallback = (locator: Locator) => Promise<void>;
export type PageLoadCallback = (page: Page) => Promise<void>;
export type PageResponseCallback = (res: Response) => Promise<void>;

export type LocatorCallbackContainer = {
  selector: string;
  callback: LocatorCallback;
}[];
export type PageLoadCallbackContainer = {
  callback: PageLoadCallback;
}[];
export type PageResponseCallbackContainer = {
  callback: PageResponseCallback;
}[];
