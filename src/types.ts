import { Locator, Page, Response } from "playwright";

export type SelectorCallback = (locator: Locator) => Promise<void>;
export type PageLoadCallback = (page: Page) => Promise<void>;
export type PageResponseCallback = (res: Response) => Promise<void>;
export type LocatorCallback = (locator: Locator) => Promise<void>;

export type SelectorCallbackContainer = {
  selector: string;
  callback: SelectorCallback;
}[];
export type PageLoadCallbackContainer = {
  callback: PageLoadCallback;
}[];
export type PageResponseCallbackContainer = {
  callback: PageResponseCallback;
}[];
export type LocatorCallbackContainer = {
  locs: Locator;
  callback: LocatorCallback;
}[];
