import licenseText from "../../LICENSE?raw";

export const GET = () => {
  return new Response(licenseText, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
