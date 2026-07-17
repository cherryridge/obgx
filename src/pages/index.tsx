import { ReactNode } from "react";
import { translate } from "@docusaurus/Translate";
import styles from "./index.module.css";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";

export default function Home() :ReactNode{
    const { siteConfig } = useDocusaurusContext();
    return(<Layout description="Homepage of OBGX documentation.">
        <header className={styles.banner}>
            <Heading as="h1" className="hero__title">{siteConfig.title}</Heading>
            <div className="hero__subtitle">{translate({id: "homepage.tagline.1", message: "Documentation for the Open Block Game Extension Interface."})}</div>
            <div className="hero__subtitle">{translate({id: "homepage.tagline.2", message: "Select an edition from the top-right dropdown to start."})}</div>
        </header>
    </Layout>);
}