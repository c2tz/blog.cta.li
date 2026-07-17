import licenseText from "../../LICENSE?raw";

export const GET = () => {
  return new Response(licenseText, {
    headers: {
      "Content-Disposition": 'inline; filename="LICENSE.txt"',
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
