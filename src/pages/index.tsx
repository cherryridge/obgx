import { ReactNode } from "react";
import { translate } from "@docusaurus/Translate";
import styles from "./index.module.css";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";

export default function Home() :ReactNode{
    const { siteConfig } = useDocusaurusContext();
    return(<Layout description="Homepage of OBGX documentation.">
        <header className={styles.banner}>
            <Heading as="h1" className="hero__title">{siteConfig.title}</Heading>
            <div className="hero__subtitle">{translate({id: "homepage.tagline.1", message: "Documentation for the Open Block Game Extension Interface."})}</div>
            <div className="hero__subtitle">
                {translate({id: "homepage.tagline.2-1", message: "Select an edition, or start from the "})}
                <Link href="overview">{translate({id: "homepage.tagline.2-2", message: "overview"})}</Link>
                {translate({id: "homepage.tagline.2-3", message: "."})}
            </div>
        </header>
    </Layout>);
}